# Events Module — Build Plan

Companion to the [Society Events design tour](https://claude.ai/code/artifact/51add5af-c2a9-4ec2-9667-f0e427f39c05) (9 screens: Home, Details, Registration, Create Event, Manage Event, Calendar, Notifications, Empty/Loading/Error). This doc translates that design into schema, roles, and a phased build — same shape as `complaints.md`. Please review/correct before I start Phase 0.

## What already exists

`database/schema.sql` has a bare, unmapped `Event` table:

```sql
CREATE TABLE Event (
    EventId INT PRIMARY KEY IDENTITY,
    EventName NVARCHAR(100),
    EventDate DATETIME,
    Description NVARCHAR(MAX)
);
```

No `SocietyId`, no category, no venue, no organizer, no registration concept, no EF entity, no controller/service. Nav item and `ComingSoon` placeholder already exist (`Events` appears in `dashboardNav.js`).

## Data model

**`Event`** — ALTER in place (matches the sql-server skill's convention for a pre-existing table that needs reshaping, not recreating):
- Add `SocietyId INT NOT NULL` (`ITenantScoped`) + audit columns (`ITenantScoped`/`IAuditable`)
- Add `EventCategoryId INT NOT NULL` (FK → new `EventCategory`)
- Rename `EventDate` → `StartOn DATETIME NOT NULL`; add `EndOn DATETIME NULL` (most events don't need an end time — flag optional)
- Add `Venue NVARCHAR(150) NOT NULL`
- Add `CoverEmoji NVARCHAR(10) NULL` and `CoverImagePath NVARCHAR(500) NULL` — the design uses a large emoji as the card banner by default (no photo needed to look good); a real cover image is an optional upgrade, not a requirement
- Add `OrganizerName NVARCHAR(150) NOT NULL` (free text, e.g. "Cultural Committee") — not a FK to a committee table, since organizer here is descriptive, not a permission boundary
- Add `MaxParticipants INT NULL` (NULL = uncapped)
- Add `RegistrationRequired BIT NOT NULL DEFAULT 1`
- Add `Status VARCHAR(20) NOT NULL DEFAULT 'Published'` — `Draft` / `Published` / `Cancelled` (forward-only-ish: `Draft→Published→Cancelled`, matching the `ComplaintStatuses.Order` pattern rather than trusting client input)
- Add `CancelReason NVARCHAR(500) NULL` — required by the service when `Status` moves to `Cancelled` (Manage Event's danger-zone copy: "notifies N registered + M waitlisted immediately")

**`EventCategory`** (new, per-society — mirrors `ComplaintCategory`/`NoticeCategory`, per the society-business-rules skill's "categories are per-society, not global" rule):
- `EventCategoryId`, `SocietyId`, `CategoryName`, `IsActive`, audit columns
- Seeded per-society on startup (`EventReferenceSeeder`, same shape as `ComplaintReferenceSeeder`) with the design's 7 defaults: Festivals, Sports, Fitness, Cultural, Kids, Meetings, Workshops. Admin can add/edit/deactivate — never hard-delete once an event references it (same guard as `ComplaintCategoryService`).

**`EventRegistration`** (new — one row per resident-flat's involvement in one event; also carries "Interested," waitlist, and cancellation, as a single status field rather than separate tables):
- `EventRegistrationId`, `EventId`, `ResidentId`, `FlatId`, `ParticipantCount INT NOT NULL DEFAULT 1`, `Comments NVARCHAR(500) NULL`
- `Status VARCHAR(20) NOT NULL` — `Interested` / `Registered` / `Waitlisted` / `CancelledByResident` / `CancelledByOrganizer`
- `RegistrationCode VARCHAR(20) NOT NULL` — the human-facing `REG-XXXXX` shown on the confirmation screen; generated server-side, unique per society
- Audit columns, unique constraint on `(EventId, ResidentId)` — one row per resident per event; changing your mind (Interested→Registered, or cancelling) updates the same row rather than inserting a new one

**`EventAttachment`** (new — mirrors `ComplaintAttachment`/`NoticeAttachment`):
- `Kind`: `Cover` (organizer-uploaded cover photo, optional alternative to the emoji banner) vs `Gallery` (post-event photos)
- Gallery entries only accepted once `Event.EndOn` (or `StartOn` if no end time) has passed — enforced server-side, not just hidden client-side, matching the Details screen's "Gallery unlocks after the event" state

## What's deliberately out of scope for v1

- **No time-based push reminders** ("starts tomorrow at 6 PM" as a proactive notification). This app has no background job/scheduler infrastructure, and adding one is a bigger decision than this module should force. v1 instead computes "starts in X" as an inline banner on the card/details page at render time — same information, no scheduler needed. Flagging this explicitly so it's a decision, not a silent gap.
- **"Only N seats remaining"** is likewise computed at render time from `MaxParticipants − confirmed registrations`, not a stored/pushed notification.
- What **does** get a real, stored `EventNotification` row (mirroring `ComplaintNotification`): registration-opened (on publish) and event-cancelled (on cancel) — both are triggered by an actual admin action, not by time passing, so they fit the existing notification pattern cleanly.

## Roles

Per the society-business-rules skill's "don't default to `CommitteeRoles`" rule — Events gets its own split, closest to Notices:
- **Create/edit/cancel events, manage categories**: `RoleNames.NoticeManagerRoles` (Admin+Secretary+Chairman) — reusing this existing const rather than inventing an `EventManagerRoles` with identical membership, unless you'd rather they diverge later.
- **View events (list/details/calendar)**: universal — every role, same as Complaints' view access.
- **Join/Interested/Cancel-own-registration**: Resident only (an event registration represents "a resident and their flat," matching how `ResidentId`/`FlatId` are captured).
- **Manage Event screen (registrations/waitlist/promote/cancel event)**: same as create/edit — `NoticeManagerRoles`.

## Frontend

- `src/api/events.js`, `eventCategories.js`, `eventRegistrations.js` — thin wrappers, `events:changed` event for the same cross-component refresh pattern as `complaints.js`.
- `src/pages/events/EventList.jsx` (hero + category chips + shelves — screen 1), `EventCategoryList.jsx` (admin CRUD — mirrors `ComplaintCategoryList.jsx`), `EventForm.jsx` (create/edit + preview toggle — screen 4), `EventDetail.jsx` (screen 2), registration modal + confirmation (screen 3), `ManageEvent.jsx` (screen 5), `EventCalendar.jsx` (screen 6).
- Remove `events` from `PLACEHOLDER_ITEMS` in `dashboardNav.js` once live.
- Carry over the design tokens from the artifact (marigold `#ee9d2e`, leaf `#2f9e6e`) as new CSS custom properties in `index.css`, additive to the existing palette — not a replacement.

## Phases (each fully verified in-browser before the next, per the feature-development skill)

1. **Schema + categories + core CRUD**: migration, `Event`/`EventCategory` entities, services/controllers, `EventList`/`EventDetail`/`EventForm`/`EventCategoryList` pages, nav wiring. No registration yet — just publish/browse/view.
2. **Registration + capacity + waitlist**: `EventRegistration`, Join/Interested/Cancel endpoints, registration modal + confirmation screen, capacity-triggered waitlisting.
3. **Manage Event + attachments**: `ManageEvent.jsx` (registrations/waitlist/promote/settings/cancel), `EventAttachment` (cover + gallery, time-gated).
4. **Calendar + notifications + polish**: `EventCalendar.jsx`, `EventNotification` (publish + cancel triggers), empty/loading/error states, the rendered "starts in X" / "N seats left" banners.

## Decisions (confirmed)

1. **Roles**: `RoleNames.NoticeManagerRoles` (Admin+Secretary+Chairman) reused as-is for event management — no new role const.
2. **Photo storage**: same convention as `NoticeAttachmentService` — local disk under `<ContentRoot>/Content/Event/`, service resolves via `IWebHostEnvironment`. Built in Phase 3 alongside gallery attachments (event cards default to the emoji banner either way — cover photo is an optional upgrade, never a blocker to publishing).
3. No screens trimmed from v1 — all 9 designed screens ship across the 4 phases as planned.
