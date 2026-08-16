# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React frontend (Vite) for a residential society management portal for **Shubhangi CHSL** (Parabat Nagar, Dahisar East, Mumbai). It is the client half of a two-repo full-stack app:

- **This repo** — React + Vite SPA, at `c:\Common\UGIT\ReactPractice`
- **Backend** — ASP.NET Core Web API, at `c:\Common\IMP\Personal\SociectyManagementCore` (yes, that folder name misspells "Society" — it's intentional, matches how it was created)
- **Database** — SQL Server, database name `Society Management` (note the space; always bracket-quote or quote it: `[Society Management]`)

The two repos are developed together but live in unrelated directory trees — there is no shared root. When working across both, open/reference the backend path explicitly.

## Commands

```bash
npm run dev       # start Vite dev server — http://localhost:5173 (hardcoded as the only CORS-allowed origin on the backend)
npm run build     # production build
npm run preview   # preview a production build
npm run lint      # oxlint (not ESLint — this project uses Oxlint, config in .oxlintrc.json)
```

No test runner is configured in this project.

The dev server URL is load-bearing: the backend's CORS policy only allows `http://localhost:5173`. If that port is already taken and Vite auto-increments to 5174/5175/etc., API calls will fail from the browser with a generic "unable to reach the server" (CORS rejection surfaces as a network error, not a CORS error, in `fetch`). Kill stray Vite processes and restart on 5173 rather than changing the CORS origin.

## Architecture

### Auth & session

- `src/api/session.js` — `localStorage`-backed session (`saveSession`/`getSession`/`clearSession`/`isSessionValid`). Stores the full `AuthResponse` from the backend (JWT + `fullName`/`email`/`role`/`expiresAtUtc`), not just the token.
- `src/api/client.js` — single `fetch` wrapper (`request`) used by everything. Unauthenticated calls (`registerResident`, `loginResident`) hit `/auth/*`. Authenticated calls (`apiGet`/`apiPost`/`apiPut`/`apiDelete`) attach `Authorization: Bearer <token>` from the stored session and auto-clear the session on a 401. ASP.NET's validation-error shape (`{ errors: { FieldName: ["msg"] } }`) is translated into `error.fieldErrors` with camelCase keys so form pages can highlight the right field.
- `src/components/RequireAuth.jsx` — route guard; redirects to `/login` if there's no valid (non-expired) session.
- `src/components/RequireRole.jsx` — route guard; redirects (default `/dashboard`) if the session's `role` isn't in the allowed list. Used to gate committee-only pages (e.g. `/dashboard/residents/new`) — this is UX-only; the backend independently enforces the same restriction via `[Authorize(Roles=...)]`, so don't treat the frontend guard as the security boundary.
- `src/config/roles.js` — `COMMITTEE_ROLES = ['Admin', 'Chairman', 'Secretary', 'Treasurer']`, must stay in sync with the backend's `RoleNames.CommitteeRoles`.

Roles are seeded server-side (`Admin`, `Chairman`, `Secretary`, `Treasurer`, `Resident`, `Security`). Registration through the app always creates a `Resident`-role account; there is no self-service way to become a committee role — promotion is a manual `UPDATE UserLogin SET RoleId = ...` against the DB.

### Routing / dashboard shell

`src/App.jsx` is the single source of truth for routes. `/dashboard` is a layout route (`DashboardLayout.jsx` = sidebar + topbar + `<Outlet/>`) wrapped in `RequireAuth`. The sidebar menu is generated from `src/config/dashboardNav.js` (`NAV_ITEMS`) — each entry has a `key`, `label`, `path`, icon path data, and a `description`. Modules that don't have real pages yet render `ComingSoon` (a shared placeholder), driven off the same `NAV_ITEMS` list so adding a real module means removing its key from the placeholder filter in `App.jsx`, not touching the sidebar.

Only **Residents** has a real module so far (`src/pages/residents/`): `ResidentList.jsx` (search + role-gated Add/Edit/Delete) and `ResidentForm.jsx` (single component handling both add and edit, keyed off whether `:residentId` is present in the URL). Follow this same shape for future modules (Flats, Maintenance, Complaints, etc.): a `src/api/<module>.js` wrapper around `apiGet/apiPost/apiPut/apiDelete`, a list page, and a combined add/edit form page, wired into `App.jsx` + removed from the `ComingSoon` placeholder list in `dashboardNav.js`'s consumers.

### Styling

Plain CSS, no UI framework/Tailwind. `src/index.css` defines CSS custom properties (`--primary`, `--surface`, `--text`, `--border`, `--gradient`, etc.) including a `prefers-color-scheme: dark` override — reuse these variables rather than hardcoding colors. Feature-specific stylesheets are split by concern and imported directly in the pages that use them: `styles/auth.css` (login/register), `styles/dashboard.css` (sidebar/topbar/home cards), `styles/dataTable.css` (list tables, badges, form cards — shared across all CRUD modules).

Icons are hand-rolled inline SVGs via `src/components/Icon.jsx` (takes a `paths` array of `<path d>` strings, fixed 24x24 viewBox, `currentColor` stroke) — no icon library dependency. Nav icons live as data in `dashboardNav.js`.

### Backend contract

Base URL comes from `VITE_API_BASE_URL` in `.env` (defaults to `http://localhost:5124/api` if unset). The backend runs over plain HTTP in Development specifically so the browser doesn't have to deal with the self-signed dev HTTPS cert — see the backend's own CLAUDE.md before assuming HTTPS.

`database/schema.sql` and `database/002_document_invoice_auditlog.sql` in this repo are the canonical SQL Server DDL for the `Society Management` database (19 tables) — this is where the table/column names/types come from when you need to know what the backend entities map to. `schema.sql` is the original hand-specified DDL; new tables get their own numbered migration file (append-only, not edited in place).
