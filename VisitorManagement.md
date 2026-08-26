# Visitor Management module — plan

Net-new module. `Visitors` is explicitly listed as "not yet built" in the backend's own
`CLAUDE.md` ("What's built so far" section). The task's 9 focus areas (entry/exit, resident
approval, visitor history, guard workflow, notifications, delivery/service visitors, multiple
visitors at once, validation, simple UI) are the feature spec this plan is built against — there
is no pre-existing module to "improve."

## Legacy schema verdict — abandoned, not salvaged

`database/schema.sql:104-133` has three never-built-on tables: `Visitor`, `SecurityGuard`,
`VisitorEntry`. All three are abandoned in place (left untouched, never mapped to a C# entity):

- `Visitor` has no `SocietyId` — a hard blocker in a multi-tenant app.
- `SecurityGuard` is a standalone entity disconnected from `UserLogin`/`Role`. The existing
  `RoleNames.Security` role already flows through the real JWT/auth system and is the correct
  guard identity.
- `VisitorEntry` duplicates `Visitor.EntryTime`/`Status` with no exit tracking.

None have any C# entity/service/controller (confirmed by grep) — the new module is pure net-new
tables in `database/015_visitors.sql` (next after `014_chat_confirmation.sql`).

## Security-role JWT shape — load-bearing fact

A `Security`-role login has no `ResidentId`/`FlatId` (`AdminCreateUserRequest.cs`: those fields
are documented "only used when RoleName is Resident"). So **a guard cannot be "the resident being
visited"** — a visitor entry must resolve the flat from an explicit guard-picked dropdown, not
from the guard's own claims, then resolve every active resident of that flat
(`Resident.FlatId == pickedFlatId`) for notification — same idiom `MaintenanceBillingService`
already uses to resolve a flat's residents.

## Schema (`database/015_visitors.sql`, append-only)

```
VisitorCategory     (VisitorCategoryId, SocietyId, CategoryName, RequiresVehicleNo,
                      RequiresCompanyName, RequiresApprovalDefault, DisplayOrder, IsActive,
                      CreatedOn/CreatedBy/ModifiedOn/ModifiedBy)   -- ITenantScoped/IAuditable
                     UNIQUE (SocietyId, CategoryName)

VisitorLog           (VisitorLogId, SocietyId, FlatId, VisitorCategoryId, PrimaryVisitorName,
                      PrimaryMobile, VehicleNo, CompanyName, PartySize, Purpose,
                      ApprovalRequired, Status, EntryTime, ExitTime, LoggedByUserId,
                      CheckedOutByUserId, CreatedOn/CreatedBy/ModifiedOn/ModifiedBy)
                     -- ITenantScoped/IAuditable — the one mutable/status-pipeline table here
                     Status: PendingApproval | Approved | Rejected | CheckedIn | CheckedOut | Cancelled
                     Index (FlatId), Index (SocietyId, Status)

VisitorLogMember     (VisitorLogMemberId, SocietyId, VisitorLogId, MemberName, CreatedOn)
                     -- plain/immutable, same exception as ComplaintUpdate/MaintenanceBillLineItem
                     -- descriptive only per the "whole group as one unit" decision below —
                     -- no independent status/exit tracking per member.

VisitorAttachment    (VisitorAttachmentId, SocietyId, VisitorLogId, FileName, ContentType,
                      FileSizeBytes, StoragePath, UploadedOn, UploadedBy)
                     -- plain, direct copy of ComplaintAttachment's shape

VisitorNotification  (VisitorNotificationId, SocietyId, VisitorLogId, RecipientUserId, Message,
                      IsRead, CreatedOn)
                     -- plain, direct copy of ComplaintNotification's shape
                     Index (RecipientUserId)
```

`Document` table is deliberately not reused for photos (no `SocietyId`, no C# entity — a dead
table per `SocChatBot.md`'s own finding). `VisitorAttachmentService` copies
`ComplaintAttachmentService`'s proven shape instead: local-disk storage under `Content/Visitor/`,
`IFormFile`, image-only (`.png`/`.jpg`/`.jpeg`), 20MB cap.

## Backend

**Entities**: `VisitorCategory.cs` (`ITenantScoped`), `VisitorLog.cs` (`ITenantScoped`),
`VisitorLogMember.cs`/`VisitorAttachment.cs`/`VisitorNotification.cs` (plain).

**DTOs**: `VisitorCategoryRequest`/`Response` (mirrors `ComplaintCategory`). `VisitorLogRequest`
(create-only: `FlatId`, `VisitorCategoryId`, `PrimaryVisitorName`, `PrimaryMobile`, `VehicleNo`,
`CompanyName`, `PartySize`, `Purpose`, `MemberNames: List<string>?`). `VisitorLogResponse`
(flattened: `FlatNo`, `CategoryName`, `Status`, timestamps, `LoggedByName`, plus server-computed
`CanApprove`/`CanReject`/`CanCheckIn`/`CanCheckOut` booleans per caller — avoids duplicating the
authorization matrix in frontend JS). Two no-body decision endpoints
(`approve`/`reject`) rather than one DTO with an `Approved` flag, matching
`ComplaintService.ConfirmResolutionAsync`'s no-body pattern. `VisitorAttachmentResponse`/
`VisitorNotificationResponse` mirror the Complaint equivalents.

**Services**:
- `VisitorCategoryService` — CRUD, delete blocked (→ deactivate) if any `VisitorLog` references
  it, mirrors `ComplaintCategoryService`/`FlatService.DeleteAsync`.
- `VisitorLogService` — the core service:
  - `CreateAsync`: resolves + validates `VisitorCategory`/`FlatId` (same society, category
    active). **Duplicate-entry guard**: reject if an existing `VisitorLog` for
    `(SocietyId, FlatId, PrimaryMobile)` is in a non-terminal state
    (`PendingApproval`/`Approved`/`CheckedIn`) — skipped when `PrimaryMobile` is blank.
    `ApprovalRequired` copied from `VisitorCategory.RequiresApprovalDefault` at creation, with
    **no per-visit guard override** (resolved decision below). If `ApprovalRequired`, status =
    `PendingApproval` and residents of the flat are notified; **if not required, the log action
    itself sets status = `CheckedIn` with `EntryTime = UtcNow`** (resolved decision below — no
    separate check-in click for no-approval categories).
  - `ApproveAsync`/`RejectAsync` — caller must be a resident of `VisitorLog.FlatId`, **or** in
    `RoleNames.CommitteeRoles` (resolved decision below: committee override is allowed). Forward-
    only status transitions via an explicit allowed-map, same discipline as `ComplaintStatuses`.
    Notifies `LoggedByUserId` of the decision.
  - `CheckInAsync`/`CheckOutAsync`/`CancelAsync` — `VisitorGateRoles` only.
  - `ListAsync`/`GetAsync` — **role-scoped read**: Resident → own flat only; Security/Committee →
    society-wide (same idiom as `MaintenanceBillingService.ListBillsAsync`'s `RoleName`
    branching). This is the opposite of Complaints/Events' deliberate broad-visibility exception —
    visitors are flat-private for residents, not society-wide. `GetAsync` returns not-found (not
    forbidden) for a flat that isn't the caller's, matching `ComplaintService`'s no-enumeration
    convention.
- `VisitorAttachmentService` — direct copy of `ComplaintAttachmentService`.
- `VisitorNotificationService` — mirrors `ComplaintNotificationService`, but
  `NotifyFlatResidentsAsync(VisitorLog)` uses the **multi-recipient loop shape**
  (`NotifyManagersAsync`'s pattern: resolve the list of `UserId`s for every `Resident` row on the
  flat, insert one `VisitorNotification` row per recipient) since a flat can have several
  residents, unlike `NotifyResidentAsync`'s single-recipient shape. Also exposes
  `ListMineAsync`/`MarkReadAsync`.
- `VisitorReferenceSeeder` — backfills default `VisitorCategory` rows (Guest, Delivery, Cab,
  Service/Domestic Help, Courier) for existing societies on startup, following the
  `ComplaintReferenceSeeder`/`NoticeReferenceSeeder` "backfill for existing tenants" convention.

All registered manually in `Program.cs` (`AddScoped<X>()`).

**New role const** (`RoleNames.cs`):
```csharp
public const string VisitorGateRoles = Admin + "," + Security;
```
Narrower than `CommitteeRoles` — Chairman/Secretary/Treasurer have no operational reason to run
the gate; Admin stays as a fallback since there's no self-service path to create a Security
account (manual DB promotion only).

**Controllers**:
- `VisitorCategoriesController` — `GET [Authorize]`; `POST/PUT/DELETE [Authorize(Roles =
  CommitteeRoles)]`.
- `VisitorsController`:
  - `GET /api/visitors`, `GET /api/visitors/{id}` — `[Authorize]`, scoping happens in the service.
  - `POST /api/visitors` — `[Authorize(Roles = VisitorGateRoles)]`.
  - `PUT /api/visitors/{id}/approve`, `PUT /api/visitors/{id}/reject` — `[Authorize]`, service-
    level resident-or-committee check.
  - `PUT /api/visitors/{id}/check-in`, `/check-out`, `/cancel` — `[Authorize(Roles =
    VisitorGateRoles)]`.
  - `POST /api/visitors/{id}/attachments` — `[Authorize(Roles = VisitorGateRoles)]`;
    `GET .../attachments/{attachmentId}` — `[Authorize]`, service-scoped.
- `VisitorNotificationsController` — `GET /api/visitor-notifications/mine`, `PUT
  /api/visitor-notifications/{id}/read` — `[Authorize]`, mirrors the Complaint notifications
  controller.

## Authorization matrix

| Action | Role(s) | Notes |
|---|---|---|
| View list/history | Any authenticated | Service-scoped: Resident → own flat; Security/Committee → society-wide |
| Log a visitor entry | `VisitorGateRoles` (Admin, Security) | Narrower than `CommitteeRoles`, deliberate |
| Approve / reject | Resident of the visited flat, or `CommitteeRoles` | Committee override allowed (resolved decision) |
| Check-in / check-out / cancel | `VisitorGateRoles` | |
| Upload/view photo | `VisitorGateRoles` (upload); scoped read | |
| Manage `VisitorCategory` | `CommitteeRoles` (write); any authenticated (read) | |

## Frontend

- `src/api/visitors.js`, `src/api/visitorCategories.js`, `src/api/visitorNotifications.js` — thin
  wrappers, same shape as the Complaint equivalents (`uploadVisitorPhoto` copies
  `uploadComplaintAttachments`'s FormData+manual-fetch shape).
- `src/pages/visitors/VisitorList.jsx` — table (`styles/dataTable.css`), default filter "today,"
  search by name/mobile/flat, columns: Time / Flat / Visitor / Category / Party size / Status /
  Actions (row actions driven by the backend's `Can*` flags, not re-derived role logic in JS). A
  "Manage Categories" link (committee-only) → `/dashboard/visitors/categories`.
- `src/pages/visitors/VisitorForm.jsx` — **create-only**, deliberate deviation from the
  Residents-style single add/edit component: a logged visitor's identity fields aren't editable
  after the fact, only its status pipeline moves forward.
- `src/pages/visitors/VisitorDetail.jsx` — read + status-action view (approve/reject/check-in/
  check-out/cancel buttons + photo), reused both as a full page (`/dashboard/visitors/:visitorLogId`)
  and embedded in `VisitorBell`'s popup — same reuse pattern `ComplaintSiren.jsx` uses with
  `ComplaintDetail.jsx`.
- `src/pages/visitors/VisitorCategoryList.jsx` + `VisitorCategoryForm.jsx` — Modal-based CRUD,
  mirrors `ComplaintCategoryList.jsx`/`ComplaintCategoryForm.jsx`.
- **`src/components/VisitorBell.jsx`** — new component (not a reuse of `NoticeBell`/
  `ComplaintSiren`/`EventBell`): copies their shell (Icon + badge + `Modal` popup + `notice-bell`
  CSS classes) but needs inline **Approve/Reject buttons directly in the dropdown** for a
  `PendingApproval` item — new interaction surface the existing bells don't have (they're pure
  glance-and-navigate). Mounted in `DashboardLayout.jsx` alongside the existing three bells, same
  `session?.role !== 'SuperAdmin'` guard (Security accounts also see it, for "your visitor was
  approved/rejected" notifications).
- **Routing** (`src/App.jsx`): remove `visitors` from the `ComingSoon` filter — the nav entry
  already exists in `dashboardNav.js`, no new nav entry needed (unlike the chatbot's from-scratch
  nav addition). Add:
  ```
  /dashboard/visitors                → VisitorList
  /dashboard/visitors/new            → VisitorForm        (RequireRole: VisitorGateRoles)
  /dashboard/visitors/:visitorLogId  → VisitorDetail
  /dashboard/visitors/categories     → VisitorCategoryList (RequireRole: CommitteeRoles)
  ```

## Validation / error handling

- Mobile format: reuse whatever validation `ResidentRequest`/`ComplaintRequest` already use.
- Required: `PrimaryVisitorName`, `FlatId`, `VisitorCategoryId` always; `VehicleNo`/`CompanyName`
  conditionally required per `VisitorCategory.RequiresVehicleNo`/`RequiresCompanyName` (service-
  level check).
- Duplicate-entry prevention: service-level check (not a DB unique constraint — `PrimaryMobile`
  can be null and legitimately repeats across visits).
- `DbUpdateException` caught around insert/status-update in `VisitorLogService`, translated to
  `ServiceResult.Fail`, per established convention.

## Resolved decisions (user sign-off, 2026-08-26)

1. **No-approval categories auto-check-in on log** — logging the entry itself sets
   `Status = CheckedIn`, `EntryTime = UtcNow`. One guard action, not two. The two-step
   log-then-confirm flow only applies when approval is actually required.
2. **Committee override on approve/reject is allowed** — `CommitteeRoles` can approve/reject any
   visitor in their society (not just the affected resident), for when a resident is unreachable.
   A real access-control widening with no precedent elsewhere in this app — deliberate, not
   accidental.
3. **Group visits tracked as one unit** — one approval, one check-in, one check-out covers the
   whole party. `VisitorLogMember` rows are descriptive only, not independently status-tracked. No
   partial-group-exit support in v1.
4. **No per-visit approval-requirement override for guards** — a category's
   `RequiresApprovalDefault` always applies as-is; a guard cannot bypass the approval gate for a
   specific visit. Simpler, no new audit-logging surface needed for this.

## Accepted without a blocking question (architect's recommended defaults, lower stakes)

5. **Photo capture is file-upload only in v1** — no live camera capture (`getUserMedia`); reuses
   `ComplaintAttachmentService`'s proven `IFormFile` pattern. Live capture is a future enhancement
   with no current precedent in this app.
6. **No shift concept in v1** — the legacy `SecurityGuard.ShiftName` column is abandoned along with
   the rest of that table. Any Security-role account sees the full society-wide "today's log," not
   a shift-filtered subset.
7. **Chatbot tool-use for approval is explicitly out of scope for v1** — `ChatToolCatalog.cs`'s
   `join_event` (`RequiresConfirmation = true`) is the exact structural analog for a future
   `approve_visitor`/`reject_visitor` chatbot tool, flagged as trivially reusable later, not built
   now (one-module-at-a-time discipline).
8. **`VisitorCategory` write access is `CommitteeRoles`**, not narrower — no stated product reason
   yet to restrict it further than the general committee set (unlike Complaints, which is
   Admin-only for a documented reason).
