# Complaints Module — Design Plan

## 0. Context & how this fits the existing app

This plan extends the existing multi-tenant Society Management app, reusing infrastructure already
built rather than inventing new mechanisms — same approach as `maintenance.md`/`notice.md`. **Revised
per user decisions** after the first draft — see §11 for exactly what changed and why.

- **`complaints` is currently a `ComingSoon` placeholder** — nav entry exists
  (`dashboardNav.js`, description "Raise, track, and resolve resident complaints."), no backend
  code exists at all. This plan graduates it into a real module the same way Maintenance and
  Notices were graduated.
- **File upload precedent already exists (`notice.md` §3)** — `NoticeAttachment` +
  `NoticeAttachmentService` establish the exact pattern this module reuses: flat storage under
  `{ContentRoot}/Content/{Module}`, `{timestamp}_{index}_{filename}` naming, never served as static
  content, always mediated through an auth-checked controller action. This module adds
  `Content/Complaint` following the identical pattern.
- **No email/SMS/push/WhatsApp infrastructure exists.** "Notifications" are built as **in-app
  notifications only** — a new per-recipient feed (§2.4), mirroring the existing Notice bell's
  mechanics exactly (polling + instant same-tab refresh on a custom event) but with its own icon
  (a siren, per user decision — §10) and its own per-recipient rows rather than a broadcast-to-
  everyone list. `whatsapp-notification.md` (a separate, currently on-hold plan) already
  anticipated a `ComplaintUpdate` WhatsApp trigger for this exact event; the call sites built here
  are the seam that plan would attach to later, but that integration is out of scope now.
- **Category is now a per-society configurable table** — **reversed from the first draft**, which
  made it a closed static list. Confirmed: each society's Admin can add, edit, or delete their own
  categories (a category one society needs, another society may not) — same shape as
  `MaintenanceCategory`/`NoticeCategory`, seeded with the request's original seven as a starter list.
- **Maintenance staff never appear as `UserLogin`/`Role` data.** Confirmed: zero system access —
  captured as plain text (name + contact number) directly on the complaint, not a linked entity.
- **All society members can view every complaint, in full detail** — **new, confirmed decision**.
  Unlike Residents/Flats (open read) vs. the original first draft (Residents saw only their own),
  visibility is now universal: any authenticated member of the society — Resident, Admin, Chairman,
  Secretary, Treasurer, Security — can open any complaint and see its full detail, timeline, and
  photos. This actually matches an existing precedent already in this app: Notices are readable by
  every society member too. Only the *write* side stays narrow (§8).
- **Only Admin has any write/action rights** — **reversed from the first draft**, which let
  Secretary/Chairman assign complaints to staff. Confirmed: Admin alone can assign, change status,
  comment, and upload resolution photos. Secretary/Chairman/Treasurer/Security can view but not act.
  Residents can create their own complaints and confirm resolution on their own complaints — nothing
  else.
- **No Draft state.** A complaint is live the instant it's submitted — no review/preview step like
  Notices has.

## 1. Design philosophy

| Concern | Modeled as | Why |
|---|---|---|
| **Category** | Per-society configurable table (`ComplaintCategory`), FK from `Complaint.CategoryId` | **Confirmed (revised):** each society manages its own list; a category one society needs (e.g. "Lift") another might not use at all. Seeded with the request's original seven (Water, Electricity, Security, Housekeeping, Parking, Lift, Others) as a starter list per new society. |
| **Priority** | Closed static list (`ComplaintPriorities`: Low/Medium/High) | Unchanged — a genuinely fixed 3-value list, no "etc." in the request. |
| **Status** | Closed static list (`ComplaintStatuses`: Open → Assigned → InProgress → Resolved → Closed), enforced forward-only | Unchanged — matches the request's explicit one-way pipeline. |
| **Maintenance staff** | Free-text `AssignedToName`/`AssignedToContact` on the complaint itself | Unchanged — they're never a login/role. |
| **Visibility** | **Universal read** — any authenticated society member can view any complaint with full details | **Confirmed, new.** Write access stays Admin-only (plus Resident's own create/confirm) — see §8. |
| **Notifications** | New `ComplaintNotification` table, one row per recipient per event, own bell icon (siren) | Targeted at specific individuals (every Admin/Secretary/Chairman on submit; the complaint's own resident on every status change/comment) — not a broadcast-to-everyone like the Notice bell, so a per-recipient row is the right shape. |
| **History / timeline** | New `ComplaintUpdate` table — one row per status change, comment, or assignment | Gives every viewer (not just the resident now) a readable "what happened and when" feed, without exposing the internal, committee-only `AuditLog`. |

### Assign vs. status/comments/resolution photos — now all Admin-only

The first draft split "assign" (Admin/Secretary/Chairman) from "status/comments/resolution photos"
(Admin-only), reading the request's flow diagram literally. **Confirmed simplification: give rights
only to Admin.** Assign, status transitions, comments, and resolution photos are now all Admin-only.
Secretary, Chairman, Treasurer, and Security can view every complaint (§0) but cannot act on any of
them.

### Resident confirmation is non-blocking

Unchanged from the first draft: when a complaint is `Resolved`, the resident sees an optional
"Confirm Resolution" button; confirming auto-closes it. Admin can also close a `Resolved` complaint
directly without waiting on the resident, so a complaint can't get stuck if the resident never
responds.

## 2. Database schema

New migration file: `database/010_complaints.sql` (next after `009_user_password_management.sql`).
All new tables are tenant-scoped (`SocietyId`, filtered by `ICurrentUserContext` in every service).

### 2.1 `ComplaintCategory` — new table, per-society, entity implements `ITenantScoped`

Same shape as `NoticeCategory`/`MaintenanceCategory` — a society's Admin can add/rename/deactivate/
delete categories; nothing downstream switches on a category's identity, so no code-paired global
list is needed.

| Column | Type | Notes |
|---|---|---|
| ComplaintCategoryId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| CategoryName | NVARCHAR(100) NOT NULL | e.g. "Water", "Lift" |
| DisplayOrder | INT NULL | |
| IsActive | BIT NOT NULL DEFAULT 1 | deactivate instead of delete once a `Complaint` references it |
| Audit columns | | UNIQUE (SocietyId, CategoryName) |

Seeded per new society (same hook shape as `MaintenanceReferenceSeeder.SeedSocietyDefaultsAsync`)
with the request's original starter list: Water, Electricity, Security, Housekeeping, Parking, Lift,
Others. A backfill pass seeds this same starter list for every existing society with zero
`ComplaintCategory` rows.

**Delete vs. deactivate**: an Admin can **delete** a category outright only while zero `Complaint`
rows reference it; once any complaint has used it, the Admin must **deactivate** it instead (it stops
appearing as a choice for new complaints, but existing complaints keep displaying it correctly) —
same integrity rule this codebase already applies elsewhere (e.g. `FlatService.DeleteAsync`'s
"linked records exist" guard).

### 2.2 `Complaint` — entity implements `ITenantScoped`/`IAuditable`

| Column | Type | Notes |
|---|---|---|
| ComplaintId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| ResidentId | INT NOT NULL FK→Resident | who raised it |
| FlatId | INT NULL FK→Flat | snapshotted from the resident's flat at submission time |
| **CategoryId** | INT NOT NULL FK→ComplaintCategory | **revised from a static code to a proper FK**, per §0/§1 |
| Description | NVARCHAR(1000) NOT NULL | |
| Priority | NVARCHAR(10) NOT NULL DEFAULT 'Medium' | validated against `ComplaintPriorities.All` |
| Status | NVARCHAR(20) NOT NULL DEFAULT 'Open' | validated against `ComplaintStatuses.All`, forward-only |
| AssignedToName | NVARCHAR(100) NULL | maintenance staff's name — plain text |
| AssignedToContact | NVARCHAR(20) NULL | phone number — plain text |
| AssignmentNotes | NVARCHAR(300) NULL | optional note from the Admin who assigned it |
| AssignedBy | INT NULL FK→UserLogin | always an Admin now (§0) |
| AssignedOn | DATETIME NULL | |
| ResidentConfirmed | BIT NOT NULL DEFAULT 0 | |
| ResidentConfirmedOn | DATETIME NULL | |
| ClosedOn | DATETIME NULL | set whether closed by resident confirmation or by Admin directly |
| Audit columns | | `CreatedBy` doubles as "raised by" for display |

### 2.3 `ComplaintUpdate` — new table, plain (insert-only timeline)

| Column | Type | Notes |
|---|---|---|
| ComplaintUpdateId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL | denormalized, same documented exception as `NoticeAttachment.SocietyId` |
| ComplaintId | INT NOT NULL FK→Complaint | |
| UpdateType | NVARCHAR(20) NOT NULL | `StatusChange` \| `Comment` \| `Assignment` |
| OldStatus | NVARCHAR(20) NULL | populated for `StatusChange` rows |
| NewStatus | NVARCHAR(20) NULL | populated for `StatusChange` rows |
| CommentText | NVARCHAR(500) NULL | populated for `Comment` rows, and optionally alongside a `StatusChange` |
| CreatedBy | INT NULL FK→UserLogin | |
| CreatedOn | DATETIME NOT NULL | |

One row per assignment, status change, or Admin comment — this **is** "complaint history," visible
to every viewer now that visibility is universal (§0) — nothing in it is more sensitive than the
complaint itself.

### 2.4 `ComplaintAttachment` — new table, plain (immutable, like `NoticeAttachment`)

| Column | Type | Notes |
|---|---|---|
| ComplaintAttachmentId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL | denormalized |
| ComplaintId | INT NOT NULL FK→Complaint | |
| AttachmentKind | NVARCHAR(20) NOT NULL | `Complaint` (resident's photos at submission) \| `Resolution` (Admin's photos after fixing it) |
| FileName / ContentType / FileSizeBytes / StoragePath / UploadedOn / UploadedBy | | identical shape to `NoticeAttachment` |

### 2.5 `ComplaintNotification` — new table, plain (per-recipient feed)

| Column | Type | Notes |
|---|---|---|
| ComplaintNotificationId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL | |
| ComplaintId | INT NOT NULL FK→Complaint | |
| RecipientUserId | INT NOT NULL FK→UserLogin | |
| Message | NVARCHAR(200) NOT NULL | e.g. `"New complaint raised: Lift — Flat A-101"`, `"Your complaint #42 is now In Progress"` |
| IsRead | BIT NOT NULL DEFAULT 0 | |
| CreatedOn | DATETIME NOT NULL | |

Recipients: **every Admin, Secretary, and Chairman** in the society on submission (per the original
request, unchanged by the Admin-only *action* restriction — Secretary/Chairman still get notified so
they stay aware, they just can't act); **the complaint's own resident** on every status change and
Admin comment. Treasurer/Security can view complaints (§0) but are not notification recipients — the
request never named them as notification targets either.

### 2.6 Static code lists (new, mirror `NoticePriorities`' shape)

```csharp
public static class ComplaintPriorities
{
    public const string Low = "Low";
    public const string Medium = "Medium";
    public const string High = "High";
    public static readonly string[] All = { Low, Medium, High };
}

public static class ComplaintStatuses
{
    public const string Open = "Open";
    public const string Assigned = "Assigned";
    public const string InProgress = "InProgress";
    public const string Resolved = "Resolved";
    public const string Closed = "Closed";
    // Order defines the only forward transitions UpdateStatusAsync will accept.
    public static readonly string[] Order = { Open, Assigned, InProgress, Resolved, Closed };
}
```

No new `RoleNames` constant is needed — every write action in this module checks the bare
`RoleNames.Admin` constant directly (§8), and view access needs no role check at all (open to any
authenticated society member).

## 3. File storage & attachment handling

Follows `notice.md` §3's pattern exactly, narrowed to photos only:

- **Storage root**: `{ProjectRoot}/Content/Complaint` — same flat layout, same
  `{yyyyMMddHHmmssfff}_{batchIndex}_{originalFileName}` naming, never registered with
  `UseStaticFiles`.
- **Allowed types**: PNG, JPG/JPEG only — the request specifically asks for "photos," not documents.
- **Size limit**: 20 MB per file (reused from Notice's limit).
- **Two upload call sites, same endpoint shape, different `AttachmentKind`**:
  - Resident uploads `Complaint`-kind photos when raising the complaint (optional) — allowed any
    time before the complaint is `Closed`.
  - **Admin** uploads `Resolution`-kind photos once work is done — allowed only once the complaint
    is `Assigned`/`InProgress`/`Resolved`.
- **Download**: `GET /api/complaints/{id}/attachments/{attachmentId}` — open to any authenticated
  society member (§0's universal visibility), same as viewing the complaint itself.

## 4. Backend implementation

**New entities** in `Models/Entities/`: `ComplaintCategory.cs` (`ITenantScoped`), `Complaint.cs`
(`ITenantScoped`), `ComplaintUpdate.cs` (plain), `ComplaintAttachment.cs` (plain),
`ComplaintNotification.cs` (plain). `DbSet`s + Fluent mappings added to `SocietyDbContext`.

**New static classes**: `ComplaintPriorities.cs`, `ComplaintStatuses.cs` (§2.6).

**New DTOs** in `Models/Dtos/`: `ComplaintCategoryRequest`/`ComplaintCategoryResponse` (same shape as
`NoticeCategoryRequest`/`Response`), `ComplaintRequest` (CategoryId, Description, Priority — Resident
create), `ComplaintResponse` (all fields + resolved `ResidentName`, `FlatNo`, `CategoryName`,
`Attachments: List<ComplaintAttachmentResponse>`), `ComplaintAssignRequest`
(AssignedToName, AssignedToContact, AssignmentNotes), `ComplaintStatusUpdateRequest`
(NewStatus, Comment?), `ComplaintCommentRequest` (CommentText), `ComplaintUpdateResponse` (timeline
entry: UpdateType, OldStatus, NewStatus, CommentText, CreatedByName, CreatedOn),
`ComplaintAttachmentResponse`, `ComplaintNotificationResponse`, `ComplaintStatsResponse` (counts by
status/category/priority).

**New service** `ComplaintCategoryService.cs` — list/create/update/deactivate/delete, same shape as
`NoticeCategoryService`, write access `RoleNames.Admin` only, read access any authenticated society
member.

**New service** `ComplaintService.cs` (injects `SocietyDbContext`, `ICurrentUserContext`,
`AuditLogService`, `ComplaintNotificationService`):
- `CreateAsync(request)` — Resident only. Resolves the caller's own `ResidentId`/current `FlatId`,
  validates `CategoryId` belongs to an active category in the caller's society, inserts
  `Status = Open`, writes one `ComplaintUpdate('StatusChange', null, 'Open')` row, then calls
  `ComplaintNotificationService.NotifyManagersAsync` (fans out to every Admin/Secretary/Chairman
  login in the society).
- `ListAsync(status?, category?, priority?, search?, dateFrom?, dateTo?)` — **any authenticated
  society member sees every complaint** (§0) — no Resident-only-sees-own scoping anymore. `search`
  matches description, resident name, and flat no.
- `GetAsync(id)` — same universal visibility, includes attachments + full `ComplaintUpdate` timeline.
- `AssignAsync(id, request)` — **`RoleNames.Admin` only** (revised from Admin/Secretary/Chairman).
  Sets the `AssignedTo*`/`AssignedBy`/`AssignedOn` fields; if `Status == Open`, flips it to
  `Assigned`; writes a `ComplaintUpdate('Assignment', ...)` row.
- `UpdateStatusAsync(id, request)` — Admin only. Rejects any transition that isn't the next step in
  `ComplaintStatuses.Order` (no skipping, no going backward). Writes a `ComplaintUpdate
  ('StatusChange', oldStatus, newStatus)` row (with the optional comment folded in), sets `ClosedOn`
  when the new status is `Closed`, and calls `ComplaintNotificationService.NotifyResidentAsync`.
- `AddCommentAsync(id, request)` — Admin only. Writes a `ComplaintUpdate('Comment', ...)` row and
  also notifies the resident.
- `ConfirmResolutionAsync(id)` — **Resident only, own complaint only, only while `Status ==
  Resolved`**. Sets `ResidentConfirmed = true`, `ResidentConfirmedOn`, transitions `Status → Closed`,
  `ClosedOn = now`, writes a `ComplaintUpdate('StatusChange', 'Resolved', 'Closed')` row.
- `GetStatsAsync()` — any authenticated society member (matches universal view access). Counts
  grouped by status, category, and priority, plus an "Active" bucket (Open + Assigned + InProgress).

**New service** `ComplaintAttachmentService.cs` — upload/download, identical shape to
`NoticeAttachmentService` (§3), parameterized by `AttachmentKind`. Upload of `Resolution`-kind
photos is Admin-only; upload of `Complaint`-kind photos is the owning Resident only; download is
open to any authenticated society member.

**New service** `ComplaintNotificationService.cs`:
- `NotifyManagersAsync(complaint)` — queries every `UserLogin` in the society whose role is Admin,
  Secretary, or Chairman, inserts one `ComplaintNotification` row each.
- `NotifyResidentAsync(complaint, message)` — resolves the complaint's `ResidentId` to its
  `UserLogin`, inserts one row.
- `ListMineAsync()` — every authenticated user's own notifications (siren feed, §10).
- `MarkReadAsync(id)` — self-service, idempotent.

**New controllers**: `ComplaintCategoriesController.cs` (`GET/POST /api/complaints/categories`,
`PUT/DELETE /api/complaints/categories/{id}`), `ComplaintsController.cs` (`GET`, `GET/{id}`, `POST`,
`POST/{id}/assign`, `POST/{id}/status`, `POST/{id}/comments`, `POST/{id}/confirm-resolution`,
`GET /stats`), `ComplaintAttachmentsController.cs` (nested under
`/api/complaints/{complaintId}/attachments`: `POST`, `GET/{attachmentId}`),
`ComplaintNotificationsController.cs` (`GET /mine`, `POST/{id}/read`).

**Audit logging**: every *Admin-side* mutating call (`AssignAsync`, `UpdateStatusAsync`,
`AddCommentAsync`, category create/update/delete) writes through the existing
`AuditLogService.LogAsync`. Resident-facing self-service actions (`CreateAsync`,
`ConfirmResolutionAsync`, `MarkReadAsync`) do not — same exemption as Notice's `MarkReadAsync`.

## 5. API design

| Resource | Endpoints | Read access | Write access |
|---|---|---|---|
| Categories | `GET/POST /api/complaints/categories`, `PUT/DELETE /api/complaints/categories/{id}` | any authenticated society member | `RoleNames.Admin` |
| Complaints | `GET /api/complaints?status=&category=&priority=&search=&dateFrom=&dateTo=`, `GET /api/complaints/{id}` | **any authenticated society member — every complaint** | `POST /api/complaints` — `RoleNames.Resident` |
| Assign | `POST /api/complaints/{id}/assign` | — | `RoleNames.Admin` |
| Status | `POST /api/complaints/{id}/status` | — | `RoleNames.Admin` |
| Comments | `POST /api/complaints/{id}/comments` | — | `RoleNames.Admin` |
| Confirm resolution | `POST /api/complaints/{id}/confirm-resolution` | — | `RoleNames.Resident`, caller's own complaint only, only while `Resolved` |
| Attachments | `POST /api/complaints/{id}/attachments` (multipart, `kind=Complaint\|Resolution`), `GET /api/complaints/{id}/attachments/{attachmentId}` | any authenticated society member | upload: owning Resident (`Complaint` kind) or `RoleNames.Admin` (`Resolution` kind) |
| Stats | `GET /api/complaints/stats` | any authenticated society member | — |
| Notifications | `GET /api/complaints/notifications/mine`, `POST /api/complaints/notifications/{id}/read` | any authenticated society member (own only) | same (self-service) |

## 6. Workflow — matches the request's own diagram, step by step

1. **Resident creates a complaint.** Category (dropdown, sourced from the society's own
   `ComplaintCategory` list), Description, Priority (Low/Medium/High, defaults Medium), optional
   photos. Submits immediately — no draft/review step.
2. **Admin, Secretary, and Chairman are notified** (siren badge, §10) — Secretary/Chairman are kept
   in the loop even though only Admin can act.
3. **Admin assigns it.** Enters the maintenance staff's name/contact (and an optional note) —
   status flips `Open → Assigned`. The staff member is contacted offline (phone/WhatsApp); they
   never see this app.
4. **Work happens offline.**
5. **Admin progresses the status.** `Assigned → InProgress → Resolved`, each with an optional
   comment and (for `Resolved`) optional resolution photos. Each step notifies the resident.
6. **Resident sees the update.** Their siren badge shows the new status; opening the complaint shows
   the full timeline and any resolution photos.
7. **Resident optionally confirms.** While `Resolved`, a "Confirm Resolution" button is available;
   confirming closes it. If the resident does nothing, Admin can close it directly instead.
8. **Anyone in the society can browse complaint history.** Every complaint (open or closed, anyone's)
   is visible with full detail to every authenticated member — Admin/managers get filters, search,
   and stats on top of that same visibility (§10).

## 7. Validation rules

- `CategoryId`: required, must reference an active `ComplaintCategory` row in the caller's own
  society.
- `Description`: required, max 1000 chars.
- `Priority`: required, must be one of `ComplaintPriorities.All` (defaults `Medium` if omitted).
- `UpdateStatusAsync`: fails with a friendly error if the requested `NewStatus` isn't the very next
  value in `ComplaintStatuses.Order` after the complaint's current status.
- `AssignAsync`: fails if the complaint is already `Resolved`/`Closed`.
- `ConfirmResolutionAsync`: fails unless `Status == Resolved` and the caller is the complaint's own
  resident.
- `ComplaintCategoryService.DeleteAsync`: fails with a friendly error ("Cannot delete — N complaints
  use this category; deactivate it instead.") if any `Complaint` row references it; deactivation is
  always allowed.
- Attachment constraints per §3 (image-only allowlist, 20 MB cap) — enforced server-side.

## 8. Role-based authorization

| Action | Resident | Admin | Secretary | Chairman | Treasurer | Security |
|---|---|---|---|---|---|---|
| View any complaint, full detail | Yes | Yes | Yes | Yes | Yes | Yes |
| Create complaint | Yes (own) | — | — | — | — | — |
| Manage categories (add/edit/delete) | — | Yes | — | — | — | — |
| Assign to staff | — | Yes | — | — | — | — |
| Update status | — | Yes | — | — | — | — |
| Add comment | — | Yes | — | — | — | — |
| Upload resolution photos | — | Yes | — | — | — | — |
| Confirm resolution | Yes (own) | — | — | — | — | — |
| View stats dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Receive notifications | Yes (own complaints) | Yes (every submission) | Yes (every submission) | Yes (every submission) | — | — |

**Confirmed**: view access (including the stats dashboard, since it's not sensitive beyond what the
list view already shows) is universal — every role can see everything. **Write access is exclusively
Admin**, plus the two Resident-only self-service actions (create, confirm own resolution).
Treasurer/Security get full view access but no notifications and no write actions — the request
never named them for either of those two things, only for viewing (§0).

## 9. Audit logging

Every Admin-side mutating call (`AssignAsync`, `UpdateStatusAsync`, `AddCommentAsync`, resolution
photo upload, category create/update/delete) writes through the existing
`AuditLogService.LogAsync`. Resident self-service actions (create, confirm resolution,
mark-notification-read) do not — same exemption already established for Notice's `MarkReadAsync`.

## 10. Frontend design

- `src/api/complaints.js` — `listComplaints(params)`, `getComplaint(id)`, `createComplaint(payload)`,
  `assignComplaint(id, payload)`, `updateComplaintStatus(id, payload)`, `addComplaintComment(id, text)`,
  `confirmResolution(id)`, `uploadComplaintAttachment(id, file, kind)`, `getComplaintStats()`.
- `src/api/complaintCategories.js` — thin wrapper, same shape as `noticeCategories.js`.
- `src/api/complaintNotifications.js` — `listMyComplaintNotifications()`,
  `markComplaintNotificationRead(id)`.
- `src/pages/complaints/ComplaintList.jsx` — replaces the `ComingSoon` placeholder. **Same dashboard
  for every role now** (§0/§8 — visibility is universal): stats cards at the top (Open, Assigned, In
  Progress, Resolved, Closed counts + category/priority breakdown), a filter bar (status, category,
  priority, date range) + free-text search, then the complaint table listing **every** complaint in
  the society. The only role-conditional pieces on this page are the **"+ Raise Complaint"** button
  (Resident only) and a **"Categories"** link (Admin only, opens `ComplaintCategoryList.jsx`).
- `src/pages/complaints/ComplaintCategoryList.jsx` + `ComplaintCategoryForm.jsx` — list + add/edit
  modal, same shape as `NoticeCategoryList.jsx`. Admin-only.
- `src/pages/complaints/ComplaintForm.jsx` — `Modal`-based create form: Category (`SelectField`,
  sourced from `listComplaintCategories()`), Priority (`SelectField`, defaults Medium), Description
  (textarea), optional photo picker (multi-file, PNG/JPG/JPEG only, same client-side pre-check
  pattern as `NoticeForm`'s attachment picker).
- `src/pages/complaints/ComplaintDetail.jsx` — open to every role. Category/priority/status badges
  (color-coded — Low/Medium/High and Open/Assigned/InProgress/Resolved/Closed each get their own
  accent color, same convention as Notice's priority badges), description, photo gallery
  (initial + resolution, visually separated), and the `ComplaintUpdate` timeline rendered as a
  vertical activity feed — visible to everyone, not just the resident. Below that, a
  **role-conditional action panel**:
  - **Admin** sees the Assign form (staff name/contact/notes, if not yet assigned), status-
    transition buttons (only the single valid next status is offered, not a free-choice dropdown),
    a comment box, and a resolution-photo uploader.
  - **Resident** (own complaint, `Status == Resolved`) sees a "Confirm Resolution" button.
  - Everyone else sees the same detail view with no action panel at all — pure read access.
- `src/components/ComplaintSiren.jsx` — new, mirrors `NoticeBell.jsx`'s mechanics exactly (60-second
  poll + instant same-tab refresh via a `complaints:changed`-style custom event, unread badge, click
  to open a popup list, click a notification to jump to that complaint) but uses a **siren icon**
  instead of a bell (per user decision) and is backed by `complaintNotifications.js`. A hand-rolled
  inline SVG siren (dome + radiating light-ray lines over a base), matching the existing icon
  convention (`Icon.jsx`'s `paths` array, 24×24 viewBox, `currentColor` stroke — no icon library).
  Mounted in `DashboardLayout.jsx` alongside the existing `NoticeBell`, hidden for SuperAdmin the
  same way.
- `src/styles/complaints.css` — new stylesheet: status/priority badge colors, stats-card grid,
  activity-feed timeline styling, photo gallery grid — reusing the app's existing CSS custom
  properties as the base palette.
- `src/config/dashboardNav.js` — the existing `complaints` entry needs no `roles` change (already
  visible to everyone, and now every role sees the same full dashboard).

## 11. Decisions — resolved

All open questions from the first draft have been answered:

1. **Only Admin has write/action rights.** Reversed from the first draft's Admin/Secretary/Chairman
   split on the Assign action — Assign, status transitions, comments, and resolution photos are all
   Admin-only now. Secretary/Chairman/Treasurer/Security can view but never act.
2. **Category is a per-society configurable table (`ComplaintCategory`)**, not a closed static list —
   reversed from the first draft, now the same shape as `MaintenanceCategory`/`NoticeCategory`. Each
   society's Admin manages their own list (add/edit/delete, with delete blocked once a complaint
   references the category — deactivate instead).
3. **Notifications reuse the Notice bell's exact mechanics, with a siren icon.** Confirmed as a new,
   separate component (`ComplaintSiren.jsx`) rather than a modification to `NoticeBell.jsx` itself —
   the two stay visually distinct (bell vs. siren) since they represent different kinds of updates.
4. **Resident confirmation is optional and non-blocking** — confirmed as originally designed. Admin
   can close a `Resolved` complaint directly if the resident never confirms.
5. **Treasurer and Security have no write/notification rights** — confirmed as originally designed.
6. **All society members can view every complaint with full detail** — new, confirmed decision. This
   reverses the first draft's "Residents see only their own" restriction; visibility is now universal
   for every role, matching how Notices already work in this app. Only writing stays narrow (item 1).

## 12. Implementation phasing

0. **Phase 0 — Schema & entities**: `CREATE TABLE ComplaintCategory`, `CREATE TABLE Complaint`
   (FK to `ComplaintCategory`), `CREATE TABLE ComplaintUpdate`, `CREATE TABLE ComplaintAttachment`,
   `CREATE TABLE ComplaintNotification`. Matching entities + `SocietyDbContext` mappings.
   `ComplaintPriorities`/`ComplaintStatuses` static classes. Seed starter categories for new +
   existing societies (§2.1).
1. **Phase 1 — Categories + core create/view/assign**: `ComplaintCategoryService`/`Controller`,
   `ComplaintService` (Create/List/Get/Assign), `ComplaintsController`, DTOs, role gating (§8),
   `ComplaintNotificationService` (`NotifyManagersAsync` only). Frontend:
   `ComplaintCategoryList.jsx`, `ComplaintForm.jsx` (no photos yet), `ComplaintList.jsx` (basic
   table, universal visibility, no stats yet), `ComplaintDetail.jsx` (no timeline/photos yet, just
   fields + Admin's Assign form), nav graduation out of `ComingSoon`. Verified end-to-end (DB → API
   smoke tests incl. role gating → basic browser test) before Phase 2.
2. **Phase 2 — Attachments**: `ComplaintAttachment` upload/download (§3), photo picker in
   `ComplaintForm` + resolution-photo uploader in `ComplaintDetail` (Admin only).
3. **Phase 3 — Status pipeline, comments, resident notifications, confirmation**:
   `UpdateStatusAsync`/`AddCommentAsync`/`ConfirmResolutionAsync`, `ComplaintUpdate` timeline
   rendering, `NotifyResidentAsync`, `ComplaintSiren.jsx` mounted in `DashboardLayout`.
4. **Phase 4 — Dashboard & polish**: `GetStatsAsync` + stats cards, filter bar + search, status/
   priority color-coded badges, activity-feed styling, `complaints.css`. Verified last since it
   depends on Phases 0–3 already working.
5. **Phase 5 (future, not built now)**: WhatsApp notification hook (once `whatsapp-notification.md`
   resumes), unifying `ComplaintSiren` and `NoticeBell` into one combined notifications center,
   SLA/overdue tracking (e.g. flag complaints open longer than N days).

Each phase is built, migrated, and verified end-to-end (API + browser) before the next starts, same
discipline as every prior module.
