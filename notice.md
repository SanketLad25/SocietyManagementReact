# Notice Management Module — Design Plan

## 0. Context & how this fits the existing app

This plan extends the existing multi-tenant Society Management app (`ReactPractice` frontend +
`SociectyManagementCore` backend + SQL Server `Society Management` DB), reusing infrastructure
already built rather than inventing new mechanisms — same approach as `maintenance.md`.

- **`Notice` table already exists, unmapped.** `database/schema.sql` defined it originally
  (`NoticeId`, `Title`, `Description`, `PublishDate`, `ExpiryDate`, `CreatedBy`);
  `003_multi_tenant_audit.sql` later added `SocietyId` (NOT NULL, FK→Society) and the standard audit
  columns (`CreatedOn`, `ModifiedOn`, `ModifiedBy`). There is **no `Notice.cs` entity and no
  `NoticesController`** — this is the same "table exists, nothing built on it yet" situation
  `Parking`/`AuditLog` were in before the Maintenance module. This plan **ALTERs** the existing table
  for new columns, it does not recreate it.
- **No file-upload precedent exists anywhere in the backend.** Searched `Controllers/`/`Services/`
  for `IFormFile`/`FromForm`/`wwwroot` — zero matches. The `Document` table exists in SQL only, with
  no entity/controller/service. This module's attachment feature is the **first** file-upload/download
  implementation in this codebase — flagged because there's no existing pattern to copy, it has to be
  designed from scratch (§3).
- **No toast/notification/popup component exists anywhere in the frontend.** Searched for
  `toast|Toast|notification|Notification|popup|Popup` — zero matches. The dashboard popup (§6) is
  also new frontend infrastructure, not a reuse.
- **Tenant isolation & audit trail**: same `ITenantScoped`/`IAuditable` interfaces, same
  `SocietyDbContext.SaveChangesAsync` auto-stamping, same `ICurrentUserContext` pattern every other
  service uses.
- **Backend/frontend shape**: thin Controllers, fat Services returning `ServiceResult<T>`; `Modal`
  popup for add/edit (not a routed page); `src/api/<module>.js` wrapper — same conventions as
  Residents/Flats/Maintenance.
- **Nav**: `notices` already exists in `dashboardNav.js` (no `roles` restriction today, so visible to
  every authenticated role) rendering via the `ComingSoon` placeholder in `App.jsx`. This plan turns
  it into a real module the same way `maintenance` was turned from a placeholder into a real section.
- **WhatsApp broadcasting is explicitly out of scope for this pass** (confirmed) — sending notices via
  WhatsApp requires a WhatsApp Business API provider account (Twilio, Meta Cloud API, Gupshup, etc.)
  and credentials that don't exist yet; it can't be wired to a personal WhatsApp number. §4 designs a
  pluggable seam (`INoticeBroadcastService`) with a no-op implementation so a real provider can be
  dropped in later without touching the rest of the module.
- **Attachment storage is local disk** (confirmed) — files land under a folder on the backend server,
  served through a download endpoint. No cloud storage account needed for this pass.

## 1. Design philosophy — updated per user decisions

| Field | Modeled as | Why |
|---|---|---|
| **Category** | **CONFIRMED (revised): per-society configurable table `NoticeCategory`** (§2.1a), FK from `Notice.CategoryId` | Original draft proposed free text since the requirement's example list ends in "etc." — user confirmed they want it scoped per society instead, same shape as `MaintenanceCategory`: a society's Secretary/Chairman/Admin can add/rename/deactivate categories, seeded with a starter list at society creation. |
| **Priority** | `NVARCHAR(20)` column, **strictly validated** against a fixed 3-value list (`Normal`/`Important`/`Urgent`) via a `NoticePriorities` static class (same shape as `RoleNames`) | Unchanged — Priority is a *closed* list in the requirement (no "etc."), and pinning/highlighting logic (§6) switches on its exact value. |
| **Status** | `NVARCHAR(20)`: `Draft` → `Published` | Unchanged — two states, no computation step in between. **Once `Published`, a notice is edit-locked** (§4/§7) — the only remaining write action is `Delete`, per user decision below. |

Two further points, now resolved:

- **No scheduled/automatic publishing** — stands as designed. `PublishDate`/time is a **display
  field** ("posted on..."), not a trigger; visibility always requires the explicit `Publish` action.
  What's new: **Publish now requires an explicit review step first** (§6/§10) — clicking "Publish"
  opens a preview of the notice exactly as residents will see it, with a separate "Confirm & Publish"
  action, rather than publishing immediately on click. This is a frontend UX gate, not a new backend
  status — `PublishAsync` itself is unchanged, just called one click later.
- **"Dismiss" and "Mark as Read" are the same action** — **CONFIRMED**, no change. A single
  `NoticeReadStatus` row removes a notice from both the popup queue and the pinned-at-top section.
- **Editing after Publish — CONFIRMED REVERSED from the original draft.** A notice can be edited
  freely while `Draft`. **Once `Published`, it can no longer be edited — only deleted.** This is
  stricter than the original draft (which allowed post-publish edits) and now matches the
  Maintenance module's "don't silently change a bylaw after the fact" instinct, just enforced via a
  hard status check rather than an effective-dated revision history (a notice has no historical rate
  to preserve, so a straight edit-lock is enough — no need for Maintenance's close-and-reopen
  pattern).

## 2. Database schema

### 2.1a `NoticeCategory` — new table, per-society, entity implements `ITenantScoped`

Same shape as `MaintenanceCategory` — a society's notice managers can add/rename/deactivate
categories; nothing downstream switches on a category's identity, so no code-paired global list is
needed here.

| Column | Type | Notes |
|---|---|---|
| NoticeCategoryId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| CategoryName | NVARCHAR(100) NOT NULL | e.g. "General", "Water Supply" |
| DisplayOrder | INT NULL | |
| IsActive | BIT NOT NULL DEFAULT 1 | deactivate instead of delete once a `Notice` references it |
| Audit columns | | UNIQUE (SocietyId, CategoryName) |

Seeded per new society (same hook as `MaintenanceReferenceSeeder.SeedSocietyDefaultsAsync`, called
from `SocietyService.CreateAsync`) with a starter list: General, Maintenance, Event, Emergency,
Meeting, Water Supply, Security. A backfill pass seeds this same starter list for every existing
society with zero `NoticeCategory` rows, matching how Maintenance categories were backfilled for
pre-existing societies.

### 2.1 `Notice` — ALTER existing table, entity implements `ITenantScoped`

| Column | Type | Status |
|---|---|---|
| NoticeId | INT PK IDENTITY | existing |
| SocietyId | INT NOT NULL FK→Society | existing (added by `003_...sql`) |
| Title | NVARCHAR(200) | existing |
| Description | NVARCHAR(MAX) | existing |
| PublishDate | DATETIME NOT NULL | existing (was nullable — tightened; display field, see §1) |
| ExpiryDate | DATETIME NULL | existing (stays optional, per requirement) |
| **CategoryId** | INT NOT NULL FK→NoticeCategory | **new** — revised from a free-text column to a proper FK per user decision (§1) |
| **Priority** | NVARCHAR(20) NOT NULL DEFAULT 'Normal' | **new** — validated against `NoticePriorities.All` in the service layer |
| **Status** | VARCHAR(20) NOT NULL DEFAULT 'Draft' | **new** — `Draft` \| `Published`, and once `Published` never reverts (§1/§4) |
| CreatedOn/CreatedBy/ModifiedOn/ModifiedBy | | existing (added by `003_...sql`) |

`CreatedBy` doubles as "sender" for display — resolved to a name at response time (§4), not stored
redundantly as a text column.

### 2.2 `NoticeAttachment` — new table, plain class (like `MaintenanceBillLineItem`)

| Column | Type | Notes |
|---|---|---|
| NoticeAttachmentId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | denormalized for direct tenant filtering without a join |
| NoticeId | INT NOT NULL FK→Notice | |
| FileName | NVARCHAR(255) NOT NULL | original filename, shown to the user |
| ContentType | NVARCHAR(100) NOT NULL | MIME type, used for preview-vs-download decisions client-side |
| FileSizeBytes | BIGINT NOT NULL | shown in the UI, also re-validated server-side on upload |
| StoragePath | NVARCHAR(400) NOT NULL | relative path under the configured uploads root (§3) — never exposed directly to the client, only via the download endpoint |
| UploadedOn | DATETIME NOT NULL | |
| UploadedBy | INT NULL FK→UserLogin | |

Plain class, not `ITenantScoped`/`IAuditable` — an attachment is immutable once uploaded (delete +
re-upload, never edited in place), same documented exception as `MaintenanceBillLineItem`.

### 2.3 `NoticeReadStatus` — new table, plain class

| Column | Type | Notes |
|---|---|---|
| NoticeReadStatusId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| NoticeId | INT NOT NULL FK→Notice | |
| UserId | INT NOT NULL FK→UserLogin | tracked per **logged-in user**, not per Resident — a Chairman or Security login can also read/dismiss a notice; not every viewer is necessarily a `Resident` row |
| ReadOn | DATETIME NOT NULL | |
| | | UNIQUE (NoticeId, UserId) |

One row = "this user has read/dismissed this notice." Absence of a row = unread + (if
Important/Urgent and not expired) pinned. This is the single mechanism behind both the dashboard
popup queue and the pinned-section logic (§1, §6).

### 2.4 Multi-tenancy & isolation

`Notice` implements `ITenantScoped` exactly like `Resident`/`Flat`/every Maintenance entity —
auto-stamped by the existing `SocietyDbContext.SaveChangesAsync` override. `NoticeService` (and every
other new service) constructor-injects `ICurrentUserContext currentUser` and filters every query by
`currentUser.SocietyId`, identical to every other module. `NoticeAttachment`/`NoticeReadStatus` carry
`SocietyId` as a plain column (documented exception, §2.2/§2.3) but are always queried/written through
their parent `Notice`'s already-tenant-checked context, never independently.

## 3. File storage & attachment handling

Since there is no existing upload pattern anywhere in this codebase (§0), this is designed fresh, at
the smallest complexity that satisfies the requirement. **Revised per user decision** (folder
location, filename format, and size limit all specified directly):

- **Storage root**: `{ProjectRoot}/Content/Notice` — a plain folder inside the backend project
  directory (not `wwwroot`, so files are never accidentally served as static content bypassing the
  auth-checked download endpoint; not statically registered with `UseStaticFiles`).
- **On-disk layout**: flat, directly inside `Content/Notice/` —
  `{yyyyMMddHHmmssfff}_{batchIndex}_{originalFileName}`. The timestamp (millisecond precision) plus a
  same-request batch index avoids collisions when multiple files are uploaded in one call; the
  original name is preserved in the DB (`FileName`) for display, not trusted as the actual disk path.
  Tenant isolation for downloads is enforced via the DB row (`NoticeAttachment.SocietyId`/`NoticeId`)
  and the authenticated download endpoint, not via folder structure — the flat layout is fine because
  nothing ever lists the directory directly.
- **Upload endpoint**: `POST /api/notices/{id}/attachments`, `multipart/form-data`, accepts multiple
  `IFormFile`. Server-side validation (not just a frontend `accept=` hint):
  - **Allowed types**: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG/JPEG — checked by file extension **and**
    declared `ContentType`, rejecting a mismatch (e.g. a `.exe` renamed to `.pdf`).
  - **Size limit**: 20 MB per file (confirmed) — also needs a matching `Kestrel`
    `MaxRequestBodySize`/`RequestSizeLimit` bump, since ASP.NET Core's default (~28.6 MB total request)
    is close enough to 20 MB per file that multi-file uploads could hit it.
- **Download/preview endpoint**: `GET /api/notices/{id}/attachments/{attachmentId}` — streams the
  file with its stored `ContentType` and `FileName` (`Content-Disposition: inline` for
  images/PDF so browsers preview them, `attachment` for DOC/XLS which browsers can't render).
  Authorization: caller must belong to the notice's society, and if the notice is still `Draft`, only
  `NoticeManagerRoles` (§8) can fetch it — a Resident should never see a draft's attachment via a
  guessed URL.
- **Delete**: `DELETE /api/notices/{id}/attachments/{attachmentId}` (`NoticeManagerRoles` only,
  **and only while the parent notice is still `Draft`** — same edit-lock as §4's `UpdateAsync`).
  Removes the DB row and the on-disk file. Deleting the parent `Notice` cascades to delete all its
  attachment rows + files (and its `NoticeReadStatus` rows) in the same service call, regardless of
  status — deleting the whole notice is still always allowed (§1/§4).

## 4. Backend implementation

**New entities** in `Models/Entities/`: `Notice.cs` (`ITenantScoped`), `NoticeAttachment.cs` (plain),
`NoticeReadStatus.cs` (plain). `DbSet`s + Fluent mappings added to `SocietyDbContext`.

**New static class** `Models/Entities/NoticePriorities.cs` (mirrors `RoleNames`' shape):
```csharp
public static class NoticePriorities
{
    public const string Normal = "Normal";
    public const string Important = "Important";
    public const string Urgent = "Urgent";
    public static readonly string[] All = { Normal, Important, Urgent };
}
```

**New role-group constant** in `RoleNames.cs`:
```csharp
/// Notice create/edit/publish/delete access. CONFIRMED to include Admin, unlike the original
/// literal "Secretary or Chairman only" draft — matches every other role-group's Admin-superset
/// convention (CommitteeRoles, BillingRoles).
public const string NoticeManagerRoles = Admin + "," + Secretary + "," + Chairman;
```

**New DTOs** in `Models/Dtos/`: `NoticeCategoryRequest`/`NoticeCategoryResponse` (same shape as
`MaintenanceCategoryRequest`/`Response`), `NoticeRequest` (Title, Description, **CategoryId**,
Priority, PublishDate, ExpiryDate — shared create/update, same rule as `ResidentRequest`),
`NoticeResponse` (all fields + `CategoryName` (resolved), computed `CreatedByName`, `IsRead`,
`ReadOn`, `IsExpired`, `IsPinned`, `Attachments: List<NoticeAttachmentResponse>`),
`NoticeAttachmentResponse` (Id, FileName, ContentType, FileSizeBytes, UploadedOn — never the raw
`StoragePath`).

**New service** `NoticeCategoryService.cs` — list/create/update/deactivate, same shape as
`MaintenanceCategoryService`, write access `NoticeManagerRoles`, read access any authenticated
society member (a Resident should see category names on notices).

**New service** `NoticeService.cs` (constructor-injects `SocietyDbContext`, `ICurrentUserContext`,
`AuditLogService`, `INoticeBroadcastService`):
- `ListAsync(categoryId?, priority?, search?, sortBy?, includeDrafts?)` — Residents/non-managers
  always see `Status == Published` only; `includeDrafts=true` is only honored for
  `NoticeManagerRoles`. Resolves `CreatedByName` per notice (prefer `UserLogin.ResidentId →
  Resident.FullName`, else `Username` — same fallback `AuthService.LoginAsync` already uses), and
  left-joins `NoticeReadStatus` for the caller's `UserId` to compute `IsRead`/`ReadOn`. `IsPinned` =
  `Priority in (Important, Urgent) AND !IsExpired AND !IsRead`.
- `GetAsync(id)` — single notice + attachments, same visibility rule as `ListAsync`.
- `CreateAsync(request)` — `NoticeManagerRoles` only, inserts as `Status = Draft`.
- `UpdateAsync(id, request)` — `NoticeManagerRoles` only, **and only while `Status == Draft`**.
  **CONFIRMED (revised): rejects the update with `ServiceResult.Fail("Cannot edit a published
  notice — delete it and create a new one instead.")` once `Status == Published`.** This replaces
  the original draft's "editable regardless of status" behavior.
- `PublishAsync(id)` — `NoticeManagerRoles` only, flips `Draft → Published` (one-way, no revert),
  then calls `INoticeBroadcastService.BroadcastAsync(notice)` (no-op today, §0/§11). The frontend
  calls this only after its review-step confirmation (§6/§10) — the endpoint itself doesn't need a
  separate "are you sure" server-side step, since publishing is already one-way and edit-locking.
- `DeleteAsync(id)` — `NoticeManagerRoles` only, allowed regardless of status (Draft or Published —
  this is the **only** write action left once Published), cascades attachments (disk + rows) and
  read-status rows.
- `MarkReadAsync(id)` — any authenticated user in the notice's society, idempotent upsert into
  `NoticeReadStatus`.

**New service** `NoticeAttachmentService.cs` — upload/download/delete per §3, injected into
`NoticeService` or called directly from `NoticeAttachmentsController` (thin either way; exact split
decided at implementation time). Upload/delete should probably also be blocked once `Status ==
Published`, for the same reason as `UpdateAsync` — an attachment change after publish is effectively
an edit; enforced the same way.

**New interface** `Services/INoticeBroadcastService.cs`:
```csharp
public interface INoticeBroadcastService
{
    Task BroadcastAsync(Notice notice, IReadOnlyList<NoticeAttachment> attachments);
}
```
Registered DI implementation for this pass: `NoOpNoticeBroadcastService` (logs "would broadcast to N
residents" and returns immediately). A real `WhatsAppNoticeBroadcastService` (Twilio/Meta Cloud
API/whatever provider is chosen later) can be swapped in via `Program.cs`'s DI registration alone —
`NoticeService.PublishAsync` never changes.

**New controllers**: `NoticesController.cs` (`GET`, `GET/{id}`, `POST`, `PUT/{id}`, `POST/{id}/publish`,
`DELETE/{id}`, `POST/{id}/read`), `NoticeAttachmentsController.cs` (nested under
`/api/notices/{noticeId}/attachments`: `POST`, `GET/{attachmentId}`, `DELETE/{attachmentId}`).

**Audit logging**: every mutating `NoticeService`/`NoticeAttachmentService` call writes one row via
the existing `AuditLogService.LogAsync`, exactly like every Maintenance service (§9 below).

## 5. API design

| Resource | Endpoints | Read access | Write access |
|---|---|---|---|
| Categories | `GET/POST /api/notices/categories`, `PUT/PATCH(deactivate) /api/notices/categories/{id}` | any authenticated society member | `RoleNames.NoticeManagerRoles` |
| Notices | `GET /api/notices?categoryId=&priority=&search=&sortBy=&includeDrafts=`, `GET /api/notices/{id}` | any authenticated society member — Published only, unless `NoticeManagerRoles` + `includeDrafts=true` | `POST` always; `PUT` only while `Status == Draft` — `RoleNames.NoticeManagerRoles` |
| Publish | `POST /api/notices/{id}/publish` | — | `RoleNames.NoticeManagerRoles` — one-way, frontend gates behind a review step (§6/§10) |
| Delete | `DELETE /api/notices/{id}` | — | `RoleNames.NoticeManagerRoles` — allowed regardless of status, the only write action left post-publish |
| Read tracking | `POST /api/notices/{id}/read` | any authenticated society member (marks their own read state) | same (self-service, no role gate needed) |
| Attachments | `POST /api/notices/{id}/attachments` (multipart), `GET /api/notices/{id}/attachments/{attachmentId}` (download/preview), `DELETE .../{attachmentId}` | download: any authenticated society member if notice is Published; `NoticeManagerRoles` if Draft | upload/delete — `RoleNames.NoticeManagerRoles`, only while the parent notice is `Draft` |

## 6. Resident notification workflow

0. **Review-before-publish (new, per user decision).** `NoticeForm`'s "Publish" button doesn't call
   `POST /api/notices/{id}/publish` directly. It first opens a read-only preview — reusing
   `NoticeDetail`'s rendering — showing exactly what residents will see (title, description,
   category/priority badges, attachments, dates). Only that preview's "Confirm & Publish" button
   actually calls the publish endpoint. Since publishing is one-way and immediately edit-locks the
   notice (§1/§4), this review step is the only chance to catch a mistake before it's permanent
   (other than deleting and starting over).
1. **Dashboard popup** — a new `NoticePopup.jsx` component mounted once at `DashboardLayout` level
   (so it fires on every dashboard route, not just `/dashboard/notices`). On mount, fetches
   `GET /api/notices` (Published, unread — i.e. `IsRead == false`), and if any exist shows the
   **highest-priority unread one** as an animated modal (Urgent > Important > Normal, then latest
   first among ties). A "Mark as Read" button calls `POST /api/notices/{id}/read`, which — per §1 —
   both dismisses the popup for that notice and removes it from the pinned section, then re-queries
   for the next unread notice (if any) rather than showing them all at once.
2. **Pinned section** — on the Notices list page, any `IsPinned == true` notice (Important/Urgent,
   not expired, not yet read by this user) renders in a distinct "Pinned" band above the regular
   grid, with its own accent color per priority. Reading it (via its card's "Mark as Read" or by
   opening its detail) removes it from this band immediately.
3. **Notice list / cards** — modern card grid (`src/styles/notices.css`, new), each card showing:
   title, category badge, priority badge (color-coded: Normal = neutral gray, Important = amber,
   Urgent = red with a subtle pulse animation), truncated description, publish date, sender name
   (`CreatedByName`), attachment count/icons, and an unread indicator dot. Clicking a card opens
   `NoticeDetail` (full description, all attachments with preview/download links).
4. **Filters/sort** — category select, priority select, free-text search (title+description),
   sort-by select (Latest / Priority / Expiry) — all client-driven query params against
   `GET /api/notices`, same shape as `ChargeRuleList`'s category filter.
5. **History** — the list is never pruned; expired/older Published notices remain visible (just no
   longer pinned), satisfying "keep a complete notice history with read/unread status." Each card's
   unread dot / "Read on {date}" reflects that specific user's own `NoticeReadStatus` row.

## 7. Validation rules

- `Title` required, max 200 chars (matches existing column). `Description` required.
- `CategoryId`: required, must reference an active `NoticeCategory` row in the caller's own society
  (§2.1a — revised from free text).
- `Priority`: required, must be one of `NoticePriorities.All` — rejected otherwise with a field error.
- `PublishDate`: required, defaults to "now" client-side but editable (§1 — display field, not a
  scheduler trigger).
- `ExpiryDate`: optional; if set, must be ≥ `PublishDate`.
- Attachment constraints per §3 (type allowlist, size cap) — enforced server-side, not just via the
  frontend `<input accept>` hint.
- `PublishAsync` is a no-op-with-friendly-error if the notice is already `Published` (same
  `ServiceResult.Fail` idiom as `MaintenanceBillingService.GenerateAsync`'s "already generated" guard).
- `UpdateAsync` / attachment upload / attachment delete all fail with a friendly error once
  `Status == Published` (§1/§4) — **CONFIRMED**: editing is Draft-only, Delete is the only
  post-publish write action.

## 8. Role-based authorization

- **Admin, Secretary, Chairman** (`RoleNames.NoticeManagerRoles`): full CRUD (edit Draft-only, §1) +
  publish + delete + attachment upload/delete (Draft-only). **CONFIRMED to include Admin** —
  matches every other role-group's Admin-superset convention (`CommitteeRoles`, `BillingRoles`).
- **Treasurer, Resident**: read-only — can view Published notices, mark them read, download
  attachments. Cannot create/edit/publish/delete.
- **Security**: same read-only access as Resident (notices like "gate closed for maintenance" are
  plausibly relevant to security staff too) — no write access.
- **SuperAdmin**: no access to any specific society's notices (consistent with SuperAdmin having no
  operational role inside a society elsewhere in this app).
- Tenant isolation is absolute regardless of role, same guarantee as every other module: every query
  filters by `currentUser.SocietyId`.

## 9. Audit logging

Every mutating `NoticeService`/`NoticeAttachmentService` call (create, update, publish, delete,
attachment upload, attachment delete) writes one row via the existing `AuditLogService.LogAsync` into
the existing `AuditLog` table — reusing infrastructure, exactly like every Maintenance service. Read
tracking (`MarkReadAsync`) does **not** write an audit log row — it's a resident-facing UX action, not
an administrative change worth an audit trail entry.

## 10. Frontend design

- `src/api/notices.js` — `listNotices(params)`, `getNotice(id)`, `createNotice(payload)`,
  `updateNotice(id, payload)`, `publishNotice(id)`, `deleteNotice(id)`, `markNoticeRead(id)`,
  `uploadNoticeAttachment(id, file)`, `deleteNoticeAttachment(id, attachmentId)`; attachment download
  is a plain `<a href>` to the authenticated endpoint (browser handles the auth header via the
  existing fetch-wrapper pattern only if the download is triggered through a signed/temporary link,
  **or** — simpler, matching this app's existing auth model — a small helper that fetches the file as
  a blob with the `Authorization` header attached and triggers a client-side download, since this
  app's endpoints aren't cookie-authenticated).
- `src/pages/notices/NoticeList.jsx` — replaces the `ComingSoon` placeholder (removed from
  `PLACEHOLDER_ITEMS`/`REAL_PAGE_KEYS` in `App.jsx`, same as every other module's graduation).
  Pinned band + filter/sort bar + responsive card grid (`auto-fill` grid, collapsing to a single
  column on narrow viewports). `NoticeManagerRoles` see a "+ New Notice" button and Draft/Published
  tabs; everyone else sees Published only.
- `src/api/noticeCategories.js` — thin wrapper, same shape as `maintenanceCategories.js`.
- `src/pages/notices/NoticeCategoryList.jsx` — list + add/edit modal, same shape as
  `CategoryList.jsx` from the Maintenance module. `NoticeManagerRoles` only.
- `src/pages/notices/NoticeForm.jsx` — `Modal`-based create/edit (disabled entirely once the notice
  being edited is `Published` — §1/§4/§7; opening "Edit" on a published notice should really just not
  be offered as an action at all, per §5). Fields per §7, `SelectField` (the shared component built
  for the Maintenance polish pass) sourced from `listNoticeCategories()` for Category, `SelectField`
  for Priority, a `datetime-local` input for `PublishDate`, a `date` input for `ExpiryDate`, a
  multi-file picker for attachments. Two actions: "Save Draft" (calls `createNotice`/`updateNotice`,
  stays Draft) and "Publish" — which, per §6 step 0, opens the review modal rather than calling the
  publish endpoint directly.
- `src/pages/notices/NoticePublishReview.jsx` — new (§6 step 0): read-only preview reusing
  `NoticeDetail`'s rendering, with a "Confirm & Publish" button that calls `publishNotice(id)` and a
  "Back to edit" button that returns to `NoticeForm`.
- `src/pages/notices/NoticeDetail.jsx` — full description, attachment list with preview (inline for
  images/PDF via an `<iframe>`/`<img>`) or download links, sender, dates, priority/category badges.
- `src/components/NoticePopup.jsx` — new, mounted in `DashboardLayout.jsx`, per §6.
- `src/styles/notices.css` — new stylesheet: priority color variables (reusing the app's existing
  `--primary`/`--surface`/`--border` custom properties as the base palette, adding priority-specific
  accent colors), card grid, badge styles, popup slide/fade-in animation, responsive breakpoints.
- `src/config/dashboardNav.js` — add a `roles` array to the existing `notices` entry (currently has
  none, meaning every role including Security sees it today — unchanged in spirit, since §8 gives
  Security read access too; this just makes the omission explicit rather than accidental).

## 11. Decisions — resolved

All open questions from the original draft have been answered:

1. **WhatsApp broadcasting is deferred, not built.** Designed as a pluggable
   `INoticeBroadcastService` seam with a no-op implementation, so a real provider can be wired in
   later without touching `NoticeService`. Needs (when that phase happens): provider choice, an
   account/credentials, and a decision on whether attachments are sent as WhatsApp media
   (provider-dependent size/type limits).
2. **Attachments stored on local disk.** Fine for a single-server deployment; would need revisiting
   (e.g. a shared network volume or cloud blob storage) if the backend ever runs across multiple
   server instances, since local disk storage isn't shared between them.
3. **`NoticeManagerRoles` = Admin + Secretary + Chairman.** Reversed from the original literal
   "Secretary or Chairman only" reading — now matches every other role-group's Admin-superset
   convention.
4. **Category is a per-society configurable table (`NoticeCategory`)**, not free text — reversed
   from the original draft, now the same shape as `MaintenanceCategory`.
5. **"Dismiss" and "Mark as Read" are the same underlying action** — confirmed as originally
   designed. Reading a notice removes it from both the popup queue and the pinned band.
6. **No scheduled/automatic publishing** — confirmed as originally designed, with one addition:
   **Publish now requires an explicit review step** (§6 step 0) before the actual publish call.
7. **Editing is locked after Publish; only Delete remains** — reversed from the original draft
   (which allowed post-publish edits). `UpdateAsync`, attachment upload, and attachment delete all
   fail once `Status == Published`; `DeleteAsync` remains available regardless of status.

## 12. Implementation phasing (respecting this project's one-phase-at-a-time discipline)

0. **Phase 0 — Schema & entities**: `CREATE TABLE NoticeCategory`, `ALTER TABLE Notice` (add
   `CategoryId` FK, `Priority`, `Status`, tighten `PublishDate` to NOT NULL), `CREATE TABLE
   NoticeAttachment`, `CREATE TABLE NoticeReadStatus`. `NoticeCategory.cs`/`Notice.cs`/
   `NoticeAttachment.cs`/`NoticeReadStatus.cs` entities + `SocietyDbContext` mappings.
   `NoticePriorities` static class, `RoleNames.NoticeManagerRoles`. Seed starter categories for new
   + existing societies (§2.1a).
1. **Phase 1 — Categories + core CRUD + publish/delete + edit-lock**: `NoticeCategoryService`/
   `Controller`, `NoticeService`/`NoticesController`, DTOs, role gating (§8), the Draft-only
   edit-lock (§4/§7), `INoticeBroadcastService`/`NoOpNoticeBroadcastService` seam (called from
   `PublishAsync` but doing nothing yet). Frontend: `NoticeCategoryList.jsx`, `NoticeList.jsx` (basic
   list, no cards/animation yet), `NoticeForm.jsx` (no attachments yet, Edit action hidden once
   Published), nav graduation out of `ComingSoon`. Verified end-to-end (DB → API smoke tests incl.
   role gating + edit-lock → basic browser test) before Phase 2.
2. **Phase 2 — Attachments**: `NoticeAttachment` upload/download/delete (§3, Draft-only per the
   edit-lock), `NoticeAttachmentsController`, file validation, frontend file picker in `NoticeForm` +
   preview/download in `NoticeDetail`.
3. **Phase 3 — Review-before-publish, read-tracking, popup, pinning, visual polish**:
   `NoticePublishReview.jsx` (§6 step 0), `NoticeReadStatus` + `MarkReadAsync`, `NoticePopup.jsx`
   mounted in `DashboardLayout`, pinned band on `NoticeList`, priority color-coding and animations,
   filters/sort, `notices.css`. This is the "modern, attractive, animated" phase — verified last
   since it depends on Phases 0–2 already working.
4. **Phase 4 (future, not built now)** — WhatsApp broadcasting: swap `NoOpNoticeBroadcastService` for
   a real provider implementation once an account/credentials exist.

Each phase is built, migrated, and verified end-to-end (API + browser) before the next starts, same
discipline as the Maintenance module.
