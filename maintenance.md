# Society Maintenance Management Module — Implementation Plan

## 0. Context & how this fits the existing app

This plan extends the existing multi-tenant Society Management app (`ReactPractice` frontend +
`SociectyManagementCore` backend + SQL Server `Society Management` DB). It reuses infrastructure
already built during the multi-tenancy conversion rather than inventing new mechanisms:

- **Tenant isolation**: every table gets `SocietyId`, auto-stamped by `SocietyDbContext.SaveChangesAsync`
  via the `ITenantScoped`/`IAuditable` interfaces (see `Models/Entities/IAuditable.cs`). Every new
  service reads the caller's `SocietyId` from `ICurrentUserContext`, exactly like `ResidentService`/
  `FlatService`.
- **Audit trail**: every table gets `CreatedOn`/`CreatedBy`/`ModifiedOn`/`ModifiedBy`, same convention
  established in migration `003_multi_tenant_audit.sql`. Two additions in this module follow the
  same *documented exceptions* already used elsewhere (`Role`, `AuditLog`): the two truly global
  reference tables (§2.1) skip `SocietyId`, and the immutable bill-line-item snapshot table skips
  `ModifiedOn`/`ModifiedBy` (same reasoning as `AuditLog`).
- **Backend shape**: thin Controllers, fat Services returning `ServiceResult<T>`, DTOs shared between
  create/update unless they diverge — same as `ResidentService`/`FlatService`/`AdminUserService`.
- **Frontend shape**: `src/api/<module>.js` wrapper, a list page + popup `Modal` (not a routed page)
  for add/edit — same as Residents/Flats/Users/Societies.
- **Nav**: `maintenance` already exists as a placeholder key in `dashboardNav.js` — this plan turns it
  into a real (multi-page) section the same way `flats` was turned from `ComingSoon` into a real page.
- **Existing tables touched**: `MaintenanceBill` and `Payment` already exist (with `SocietyId` +
  audit columns from the earlier migration) and are *extended*, not replaced.

## 1. Design philosophy

The one hard requirement is: **no maintenance category, amenity, parking type, flat grouping, or
rate is hardcoded** — they are rows a Society Admin creates/edits/deactivates through the UI. The
only things that stay as a small, code-backed reference list are the *kinds of technical building
blocks* the system knows how to evaluate — the same way this app already treats `Role` as a small
global list while `Resident`/`Flat` are fully data-driven per society. Concretely:

| Stays as a small global/code list (§2.1) | Fully configurable per society (§2.2+) |
|---|---|
| **Calculation method types** (Fixed, Per-Sq-Ft, Per-Unit, Slab, Percentage-of-another-charge, Formula) — the *set of kinds* only; each society enables/disables which it uses | Maintenance categories (Water, Sinking Fund, custom...) |
| **Charge target types** (All Flats, Wing, Flat Group, Specific Flat, Parking Type, Amenity) — same: fixed *kinds*, per-society enable/disable | **Billing frequencies** (Monthly, Quarterly, custom cadences...) — fully per-society now, same shape as Categories |
| | Parking types (2W, 4W, EV, custom...), Amenities (Gym, Pool, custom...), rates, effective dates, exemptions, flat groups |

A follow-up question sharpened this table: "differ by society by society" turned out to mean three
different things for these three tables, resolved as follows —
- **Calculation methods** stay fully global/code-paired (confirmed, §11.6) — a society picks and
  parameterizes one per rule, but can't invent a new algorithm without a deploy.
- **Charge target types** stay global/code-defined (the resolution logic for each is hardcoded), but
  each society can now **enable/disable** which of the 6 it uses (§2.1's new
  `SocietyChargeTargetType` table) — e.g. a society with no parking hides `ParkingType` from its
  rule-creation UI, without any new resolution code.
- **Billing frequencies** turned out not to need a shared code-list at all — nothing downstream
  switches on a frequency's identity, only its `IntervalMonths` — so it moved entirely to §2.2 as a
  normal per-society config table, same shape as `MaintenanceCategory`.

This is a deliberate, industry-standard trade-off (the same one Stripe/QuickBooks-style billing
engines make): the *shapes* of calculation are a small, stable set implemented once as pluggable
strategies; the *values* inside each shape are infinite and 100% data-driven. A brand-new category,
amenity, parking type, rate, or target-group requires **zero code changes** — only a new row. A
genuinely new calculation *shape* (rare) requires one new C# strategy class; the plan includes a
generic **Formula** method (§3) as an escape hatch so most "new billing rule" requests can be met
with configuration alone, via a safe expression evaluated against named variables.

## 2. Database schema

### 2.1 Global reference tables (not per-society — same status as `Role`)

**`CalculationMethod`**
| Column | Type | Notes |
|---|---|---|
| CalculationMethodId | INT PK IDENTITY | |
| MethodCode | VARCHAR(30) UNIQUE | `FixedAmount`, `PerSqFt`, `PerUnit`, `SlabTiered`, `PercentageOfCategory`, `Formula` |
| MethodName | NVARCHAR(100) | Display name |
| Description | NVARCHAR(300) NULL | |
| ParametersSchema | NVARCHAR(MAX) NULL | JSON describing the extra params this method expects in `MaintenanceChargeRule.ParametersJson` — lets the admin UI render the right fields dynamically per method, without hardcoding a form per method |
| IsActive | BIT | |
| CreatedOn/By, ModifiedOn/By | | Managed by SuperAdmin only — adding a *type* here should be paired with a corresponding strategy class (see §3) |

**`ChargeTargetType`**
| Column | Type | Notes |
|---|---|---|
| ChargeTargetTypeId | INT PK IDENTITY | |
| Code | VARCHAR(30) UNIQUE | `AllFlats`, `Wing`, `FlatGroup`, `SpecificFlat`, `ParkingType`, `Amenity` |
| Label | NVARCHAR(100) | |
| IsActive | BIT | |
| Audit columns | | Added for consistency with `CalculationMethod` right above and every other table — an earlier draft of this table omitted them, caught while writing `MaintenanceImplementation.md`'s migration |

These two are seeded once (a `MaintenanceReferenceSeeder`, same pattern as `DbSeeder.SeedRolesAsync`)
and never touched by a Society Admin — only SuperAdmin, and only when a genuinely new calculation
shape or target kind is added to the codebase.

**`SocietyChargeTargetType`** (new, per-society) — lets each society hide the target kinds it
doesn't use (e.g. no `ParkingType` if the society has no parking) from its rule/exemption-creation
UI, without touching the global `ChargeTargetType` list itself.

| Column | Type | Notes |
|---|---|---|
| SocietyChargeTargetTypeId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| ChargeTargetTypeId | INT NOT NULL FK→ChargeTargetType | |
| IsEnabled | BIT NOT NULL DEFAULT 1 | |
| Audit columns | | UNIQUE (SocietyId, ChargeTargetTypeId) |

Seeded with one row per `ChargeTargetType`, `IsEnabled = 1`, at the same time a new `Society` is
created (alongside the starter `MaintenanceCategory` seed, §2.2) — so every society starts with all
6 kinds available and can disable the ones it doesn't need. `MaintenanceChargeRuleService`/
`MaintenanceExemptionService` only offer/accept target types enabled for the caller's society.

### 2.2 Society-scoped master/config tables

**`MaintenanceCategory`** — the configurable bucket (Water Charges, Sinking Fund, Parking
Maintenance, Amenities Charges, custom...). One category can have *multiple* `MaintenanceChargeRule`
rows (e.g. "Parking Maintenance" split into a Two-Wheeler rate and a Four-Wheeler rate) — the
category is the reporting/ledger bucket, the rule is the specific rate + who it applies to.

| Column | Type | Notes |
|---|---|---|
| CategoryId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| CategoryName | NVARCHAR(100) | e.g. "Water Charges" |
| CategoryCode | VARCHAR(30) NULL | optional short code for statements/exports |
| Description | NVARCHAR(300) NULL | |
| DisplayOrder | INT NULL | |
| IsActive | BIT DEFAULT 1 | deactivate instead of delete once bills reference it (§7) |
| Audit columns | | |
| | | UNIQUE (SocietyId, CategoryName) |

A society is seeded (not hardcoded — just an initial data seed a SuperAdmin/Admin can edit or delete)
with the starter list from the requirements: Water Charges, Sinking Fund, Repair Fund, Education
Fund, Service Charges, Insurance Charges, Common Electricity Charges, Common Welfare Charges, Fire
Audit Charges, Parking Maintenance Charges, Amenities Charges. This is a **data seed**, not a schema
constraint — a society can rename, deactivate, or delete every one of them.

**`BillingFrequency`** (per society — moved here from §2.1 after review: nothing downstream switches
on a frequency's identity, only its `IntervalMonths`, so there was no reason to keep it a shared
global list. A society can now define its own cadences, e.g. a custom "Bi-Monthly.")

| Column | Type | Notes |
|---|---|---|
| BillingFrequencyId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| Label | NVARCHAR(50) | e.g. "Monthly", "Quarterly", "Bi-Monthly" |
| IntervalMonths | INT | 1/3/6/12/etc., `0` for a one-time (non-recurring) frequency — lets the billing-cycle generator compute next-due dates generically instead of switching on a fixed set of codes |
| IsActive | BIT | |
| Audit columns | UNIQUE (SocietyId, Label) | |

Seeded per new society with a starter list (Monthly, Quarterly, Half-Yearly, Annually, One-Time) —
a **data seed**, same as `MaintenanceCategory` — the Admin can rename, deactivate, or add to it
freely.

**`ParkingType`** (Two Wheeler / Four Wheeler / EV / Bicycle / custom, per society)
| Column | Type |
|---|---|
| ParkingTypeId | INT PK IDENTITY |
| SocietyId | INT NOT NULL FK→Society |
| TypeName | NVARCHAR(50) |
| DisplayOrder | INT NULL |
| IsActive | BIT |
| Audit columns | UNIQUE (SocietyId, TypeName) |

The existing `Parking` table gets one additive column: `ParkingTypeId INT NULL FK→ParkingType`
(nullable, backfilled by best-effort matching against the existing free-text `VehicleType` column,
which stays as a display fallback rather than being dropped — a non-breaking migration, consistent
with how `003_multi_tenant_audit.sql` always added rather than replaced).

**`Amenity`** (Gym, Pool, Clubhouse, Garden, EV Charging, Play Area, Community Hall, custom)
| Column | Type |
|---|---|
| AmenityId | INT PK IDENTITY |
| SocietyId | INT NOT NULL FK→Society |
| AmenityName | NVARCHAR(100) |
| Description | NVARCHAR(300) NULL |
| RequiresOptIn | BIT DEFAULT 0 | e.g. Gym requires opt-in; Garden may be a blanket charge |
| DisplayOrder | INT NULL |
| IsActive | BIT |
| Audit columns | UNIQUE (SocietyId, AmenityName) |

**`AmenitySubscription`** (which flats opted into an opt-in amenity, and since when)
| Column | Type |
|---|---|
| SubscriptionId | INT PK IDENTITY |
| SocietyId | INT NOT NULL FK→Society |
| AmenityId | INT NOT NULL FK→Amenity |
| FlatId | INT NOT NULL FK→Flat |
| EffectiveFrom | DATE NOT NULL |
| EffectiveTo | DATE NULL |
| IsActive | BIT |
| Audit columns | |

*(Scoped to Flat, not individual Resident, to match how `MaintenanceBill` already bills at the flat
level. Per-member amenity billing within a flat is a plausible phase-2 extension, not built now —
flagged in §11.)*

**`FlatGroup`** / **`FlatGroupMember`** — arbitrary admin-curated groupings (e.g. "2BHK Flats", "Wing
A", "Ground Floor") beyond what `Wing` already gives you.

| `FlatGroup` | Type | | `FlatGroupMember` | Type |
|---|---|---|---|---|
| FlatGroupId | INT PK IDENTITY | | FlatGroupId | INT FK→FlatGroup |
| SocietyId | INT NOT NULL FK→Society | | FlatId | INT FK→Flat |
| GroupName | NVARCHAR(100) | | SocietyId | INT NOT NULL FK→Society |
| Description | NVARCHAR(300) NULL | | Audit columns | |
| IsActive | BIT | | | PRIMARY KEY (FlatGroupId, FlatId) |
| Audit columns UNIQUE(SocietyId, GroupName) | | | | |

**`MaintenanceChargeRule`** — the actual rate + who it applies to + when. This is the table that
makes "2W/4W parking split, or no parking charge at all" and "some societies don't have a clubhouse"
work without any schema change: it's just zero, one, or many rows per category.

| Column | Type | Notes |
|---|---|---|
| RuleId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| CategoryId | INT NOT NULL FK→MaintenanceCategory | |
| CalculationMethodId | INT NOT NULL FK→CalculationMethod | |
| ChargeTargetTypeId | INT NOT NULL FK→ChargeTargetType | |
| TargetId | INT NULL | polymorphic: WingId / FlatGroupId / FlatId / ParkingTypeId / AmenityId depending on `ChargeTargetTypeId`; NULL when target type is `AllFlats`. **Not FK-enforced at the DB level** (it can't point at five different tables) — validated in `MaintenanceChargeRuleService` instead. This is a documented, deliberate trade-off, not an oversight. |
| Rate | DECIMAL(12,2) NOT NULL | primary numeric parameter (fixed amount, per-sqft rate, per-unit rate, or percentage) |
| ParametersJson | NVARCHAR(MAX) NULL | method-specific extra params (e.g. slab thresholds array, the source CategoryId for `PercentageOfCategory`, the expression string for `Formula`) — avoids a wide table of mostly-null columns for every method's unique shape |
| BillingFrequencyId | INT NOT NULL FK→BillingFrequency | |
| EffectiveFrom | DATE NOT NULL | |
| EffectiveTo | DATE NULL | NULL = open-ended |
| IsActive | BIT DEFAULT 1 | |
| Audit columns | | |
| | | INDEX (SocietyId, CategoryId, ChargeTargetTypeId, TargetId, EffectiveFrom) |

**Rates are never edited in place.** Changing a rate = close the current rule (`EffectiveTo` = the
day before) and insert a new rule row with the new `Rate`/`EffectiveFrom`. This is what makes
"manage effective dates" real: every past bill's line item stays explainable by the rule version
that was actually active when it was billed, even after ten rate changes.

**`MaintenanceExemption`** — society bylaw waivers (e.g. ground-floor flats exempt from lift
charges, a specific flat granted a hardship waiver). **Targets a flat OR a group**, reusing the same
`ChargeTargetType`/`TargetId` polymorphism as `MaintenanceChargeRule`, so "exempt all ground-floor
flats" is one row instead of one row per flat — this was a gap in an earlier draft (flat-only
targeting) caught during review.

| Column | Type |
|---|---|
| ExemptionId | INT PK IDENTITY |
| SocietyId | INT NOT NULL FK→Society |
| CategoryId | INT NOT NULL FK→MaintenanceCategory |
| ChargeTargetTypeId | INT NOT NULL FK→ChargeTargetType | `SpecificFlat` or `FlatGroup` (`Wing`/`AllFlats` also valid if a whole wing/society is waived) |
| TargetId | INT NULL | FlatId or FlatGroupId depending on type; same not-FK-enforced trade-off as `MaintenanceChargeRule.TargetId` |
| Reason | NVARCHAR(300) NULL |
| EffectiveFrom | DATE NOT NULL |
| EffectiveTo | DATE NULL |
| IsActive | BIT |
| Audit columns | |

### 2.3 Transaction / billing tables

**`MaintenanceBillingCycle`** — one row per billing period a society generates bills for.

| Column | Type |
|---|---|
| CycleId | INT PK IDENTITY |
| SocietyId | INT NOT NULL FK→Society |
| CycleLabel | NVARCHAR(50) | e.g. "April 2026" |
| PeriodStart / PeriodEnd | DATE NOT NULL |
| DueDate | DATE NOT NULL |
| Status | VARCHAR(20) | `Draft` → `Generated` → `Published` → `Closed` |
| GeneratedOn | DATETIME NULL |
| GeneratedBy | INT NULL FK→UserLogin |
| Audit columns | UNIQUE (SocietyId, PeriodStart, PeriodEnd) |

**`MaintenanceBill`** (existing table — additive migration, same style as `003_...sql`)
- \+ `CycleId INT NULL FK→MaintenanceBillingCycle` (nullable for backward compatibility; every
  newly generated bill sets it)
- \+ `OutstandingAmount DECIMAL(10,2) NULL`
- \+ `PenaltyAmount DECIMAL(10,2) NULL DEFAULT 0` (late-fee support, phase 2)
- *(already has `SocietyId` + audit columns from the earlier multi-tenant migration)*

**`MaintenanceBillLineItem`** (new) — the line-by-line breakdown of a bill. This is the table that
makes a bill *explainable* and keeps history immutable even if config changes later.

| Column | Type | Notes |
|---|---|---|
| LineItemId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| BillId | INT NOT NULL FK→MaintenanceBill | |
| RuleId | INT NULL FK→MaintenanceChargeRule | nullable — a rule can later be hard-deleted (§7), the line item must survive |
| CategoryId | INT NOT NULL FK→MaintenanceCategory | denormalized, for fast reporting even if the rule is gone |
| Description | NVARCHAR(200) NOT NULL | frozen label, e.g. "Parking Maintenance — Two Wheeler" |
| Amount | DECIMAL(10,2) NOT NULL | **frozen computed amount — never recomputed retroactively** |
| CreatedOn | DATETIME NOT NULL | |

*(No `CreatedBy`/`ModifiedOn`/`ModifiedBy` — same documented exception as `AuditLog`: this is an
immutable, insert-only snapshot row, never updated after bill generation. **Implementation note
caught during review**: `Models/Entities/IAuditable.cs` currently defines `ITenantScoped : IAuditable`,
so anything implementing `ITenantScoped` is required to carry all four audit properties — a table
with only `SocietyId` + `CreatedOn` literally cannot implement that interface as written.
`MaintenanceBillLineItem` (and the not-yet-built `AuditLog` entity, which has the identical
partial-audit shape) should be a **plain class implementing neither `ITenantScoped` nor
`IAuditable`**, with `SocietyId` and `CreatedOn` set explicitly by `MaintenanceBillingService` at
insert time. `SocietyDbContext.SaveChangesAsync`'s auto-stamp loop (§2.5) simply won't touch these
two tables; that's expected, not a gap.)*

**`Payment`** (existing, already has `SocietyId` + audit) — no structural change in this phase.
Multi-bill payment allocation (`PaymentAllocation`) is called out as a phase-2 idea in §11, not
built now, to avoid scope creep beyond what was asked.

### 2.4 How categories map to societies / buildings / wings / flats / parking / amenities / members / billing cycles

```
Society ──< MaintenanceCategory ──< MaintenanceChargeRule >── ChargeTargetType
                                            │                        │
                                            │                (which kind of target)
                                            ▼
                              TargetId resolves to one of:
                              AllFlats (no id) | Wing | FlatGroup → FlatGroupMember → Flat
                              | Flat (direct) | ParkingType → Parking → Flat | Amenity → AmenitySubscription → Flat

MaintenanceBillingCycle ──< MaintenanceBill (per Flat, per Cycle) ──< MaintenanceBillLineItem >── MaintenanceChargeRule
                                                                                              (frozen snapshot reference)
```

Generating a bill for a flat in a cycle = resolve every **active, currently-effective**
`MaintenanceChargeRule` whose target resolves (directly or via Wing/FlatGroup/ParkingType/Amenity)
to that flat, minus anything covered by an active `MaintenanceExemption` whose target (flat, flat
group, wing, or whole society) also resolves to that flat for the same category, compute each
remaining rule's amount via its `CalculationMethod`, and freeze each as one
`MaintenanceBillLineItem`.

### 2.5 Multi-tenancy & isolation

Every table in §2.2–2.3 gets `SocietyId` and implements `ITenantScoped` (which requires full
`IAuditable`) exactly like `Resident`/`Flat` — auto-stamped by the existing
`SocietyDbContext.SaveChangesAsync` override, no new mechanism needed. Every service constructor
takes `ICurrentUserContext currentUser` and filters every query by `currentUser.SocietyId`, and every
mutating action stamps `SocietyId` from the same source — identical to `ResidentService`/
`FlatService`. Two documented exceptions to the blanket rule, both already called out at their
definition above:
- `CalculationMethod` and `ChargeTargetType` (§2.1) skip `SocietyId` entirely — matching the existing
  `Role` precedent (global, not per-society). `SocietyChargeTargetType` and `BillingFrequency` are
  **not** exceptions — both carry `SocietyId` and implement `ITenantScoped` normally, despite living
  next to the global tables in the numbering.
- `MaintenanceBillLineItem` (§2.3) carries `SocietyId` but implements **neither** `ITenantScoped`
  nor `IAuditable` — it's stamped manually by `MaintenanceBillingService`, not by the
  `SaveChangesAsync` auto-stamp loop, because its partial audit shape (`CreatedOn` only) doesn't fit
  those interfaces as currently defined (see the implementation note under §2.3).

## 3. Calculation engine

A small `ICalculationStrategy` interface with one implementation per `CalculationMethod.MethodCode`,
resolved via a factory keyed off the code:

```csharp
public interface ICalculationStrategy
{
    string MethodCode { get; }
    decimal Calculate(MaintenanceChargeRule rule, FlatBillingContext context);
}
```

`FlatBillingContext` carries what a rule might need: the flat's `AreaSqFt`, unit counts (e.g. number
of parking slots of that type at this flat), and a resolver to look up another category's computed
amount (for `PercentageOfCategory`).

| MethodCode | Uses `Rate` as | Uses `ParametersJson` for |
|---|---|---|
| `FixedAmount` | flat amount | — |
| `PerSqFt` | rate per sq ft | — (multiplies by `Flat.AreaSqFt`) |
| `PerUnit` | rate per unit | which "unit" to count (e.g. parking slots of `TargetId`'s ParkingType at this flat) |
| `SlabTiered` | fallback/base rate | `[{ "upTo": 500, "rate": 2 }, { "upTo": 1000, "rate": 3 }, ...]` |
| `PercentageOfCategory` | percentage (e.g. 10 = 10%) | `{ "sourceCategoryId": 3 }` |
| `Formula` | unused | `{ "expression": "AreaSqFt * 1.5 + BaseMaintenance" }` — evaluated by a sandboxed expression evaluator (e.g. NCalc or a small hand-rolled evaluator restricted to arithmetic over named variables) against a fixed variable whitelist. This is the configuration-only escape hatch for calculation shapes that don't fit the other five. |

Adding a *sixth* fundamentally new shape is the one place this system needs a code change (a new
`ICalculationStrategy` + a `CalculationMethod` row); everything else — new categories, new amenities,
new parking types, new rates, new target groups, new bylaws/exemptions — is pure configuration.

## 4. Backend implementation (mirrors existing conventions exactly)

**Prerequisite entities that don't exist yet — do these first, they're smaller net-new work than
they look.** As of this plan, `Models/Entities/` only has `Flat`, `Resident`, `Role`, `RoleNames`,
`Society`, `UserLogin`, `IAuditable` — there is **no `AuditLog` or `Parking` C# entity yet**, even
though both tables already exist in the DB with `SocietyId` + audit columns from the earlier
migration. This module needs both:
- `Parking.cs` (+ `DbSet`/Fluent mapping) — needed because §2.4's `ParkingType → Parking → Flat`
  resolution requires querying it. Add the planned `ParkingTypeId INT NULL FK→ParkingType` column
  (§2.2) at the same time.
- `AuditLog.cs` (+ `DbSet`/Fluent mapping) — needed because §9's audit logging writes to it. Per
  §2.5, this entity implements neither `ITenantScoped` nor `IAuditable` (same partial-audit shape as
  `MaintenanceBillLineItem`); it already has its own `UserId` column serving the "who" role instead
  of `CreatedBy`.

New entities in `Models/Entities/`: `MaintenanceCategory`, `BillingFrequency`, `ParkingType`,
`Amenity`, `AmenitySubscription`, `FlatGroup`, `FlatGroupMember`, `MaintenanceChargeRule`,
`MaintenanceExemption`, `SocietyChargeTargetType`, `MaintenanceBillingCycle`,
`MaintenanceBillLineItem` (plain class, see §2.3/§2.5 — not `ITenantScoped`/`IAuditable`), plus the
two global lookups `CalculationMethod`, `ChargeTargetType`. Extend `MaintenanceBill` (add the three
new columns) and add its `DbSet` + Fluent mapping in `SocietyDbContext` if not already mapped.

**Seeding update**: `SocietyService.CreateAsync` (the SuperAdmin "create a new society" flow) now
also seeds, for the new society: the starter `MaintenanceCategory` list, the starter
`BillingFrequency` list, and one `SocietyChargeTargetType` row per global `ChargeTargetType`
(`IsEnabled = 1`) — three data seeds at society-creation time, all editable afterward by that
society's Admin.

New DTOs in `Models/Dtos/`, one Request/Response pair per resource (shared request DTO for
create+update unless fields diverge, same rule as `ResidentRequest`) — **with one deliberate
exception**: `POST /charge-rules/{id}/revise` (§5) is not a plain update and gets its own narrower
`ReviseChargeRuleRequest` (just the new `Rate`/`ParametersJson`/`EffectiveFrom`), since it's
semantically "close this rule version and open a new one," not "edit this rule in place."

New Services in `Services/`, one per resource, all constructor-injecting
`(SocietyDbContext db, ICurrentUserContext currentUser)`:
- `MaintenanceCategoryService`, `ParkingTypeService`, `AmenityService`, `FlatGroupService`,
  `MaintenanceChargeRuleService`, `MaintenanceExemptionService` — straightforward
  list/get/create/update/deactivate CRUD, same shape as `FlatService`.
- `MaintenanceBillingService` — the batch bill-generation engine (§6), including the dry-run preview
  endpoint.
- A small `AuditLogService.LogAsync(action, tableName, recordId, details)` (new, reusing the existing
  `AuditLog` table, once `AuditLog.cs` exists per above) — called from every mutating method above
  (§9).

New Controllers in `Controllers/`, thin. Add one new constant to `RoleNames.cs` rather than an inline
role-string literal in a controller attribute (matching backend `CLAUDE.md`'s explicit instruction
not to hand-roll role-list strings per controller):

```csharp
/// Billing-cycle generate/publish access — narrower than CommitteeRoles (no Chairman/Secretary).
public const string BillingRoles = Admin + "," + Treasurer;
```

Read access is **not** a uniform `[Authorize]` blanket across every new controller — see §5's
per-resource table, which now distinguishes "open to any authenticated society member"
(Categories/Amenities/ParkingTypes/reference data — residents should see what they might be charged
for) from "committee-only reads" (Exemptions — waiver reasons are sensitive per-flat data a Resident
should not be able to enumerate for other flats).

## 5. API design

| Resource | Endpoints | Read access | Write access |
|---|---|---|---|
| Categories | `GET/POST /api/maintenance/categories`, `PUT/PATCH(activate) /api/maintenance/categories/{id}` | any authenticated society member (a Resident should be able to see what categories exist) | Admin |
| Charge rules | `GET /api/maintenance/charge-rules?categoryId=`, `POST /api/maintenance/charge-rules`, `POST /api/maintenance/charge-rules/{id}/revise` (closes old rule, creates the new effective-dated version via `ReviseChargeRuleRequest` — not a raw PUT, to protect history) | any authenticated society member (§10's "what applies to my flat" view needs this) | Admin |
| Parking types | `GET/POST/PUT /api/maintenance/parking-types` | any authenticated society member | Admin |
| Amenities | `GET/POST/PUT /api/maintenance/amenities`, `GET/POST /api/maintenance/amenities/{id}/subscriptions` | Amenities: any authenticated society member. Subscriptions: `RoleNames.CommitteeRoles` + the subscribed Resident themself only (not other residents') | Admin (subscriptions: Admin) |
| Flat groups | `GET/POST/PUT /api/maintenance/flat-groups`, `.../members` | `RoleNames.CommitteeRoles` | Admin |
| Exemptions | `GET/POST/PUT /api/maintenance/exemptions` | `RoleNames.CommitteeRoles` **only** — waiver reasons are sensitive per-flat/per-group data; a Resident must not be able to enumerate other flats' exemptions | Admin |
| Billing cycles | `GET/POST /api/maintenance/billing-cycles`, `POST /api/maintenance/billing-cycles/{id}/generate`, `GET /api/maintenance/billing-cycles/{id}/preview?flatId=` (dry-run, §6 — no persistence) | `RoleNames.CommitteeRoles` (Chairman/Secretary can view cycles and the active rule summary; only Admin/Treasurer see the action buttons, §10) | `RoleNames.BillingRoles` (Admin, Treasurer — new constant, §4) for generate/publish |
| Bills | `GET /api/maintenance/bills?flatId=&cycleId=`, `GET /api/maintenance/bills/{id}` (with line items) | any authenticated user of the society; a Resident's query is always forced to their own linked `FlatId` server-side, never client-supplied | (read-only resource in this phase — payments recorded via existing `Payment` endpoints) |
| Billing frequencies | `GET/POST/PUT /api/maintenance/billing-frequencies` | any authenticated society member | Admin (per-society now, §2.2 — not global) |
| Charge target types | `GET /api/maintenance/charge-target-types` (global list, annotated with `isEnabledForSociety` for the caller's society), `PUT /api/maintenance/charge-target-types/{id}/enablement` (toggle for the caller's society only) | any authenticated society member | Admin (toggles `SocietyChargeTargetType`, not the global row) |
| Calculation methods (reference) | `GET /api/maintenance/calculation-methods` | any authenticated user | SuperAdmin-only (§2.1 — unchanged, fully global) |

## 6. Bill generation workflow

1. Admin/Treasurer opens (or the system auto-opens on schedule) a `MaintenanceBillingCycle` in
   `Draft` for a period. The cycle's own page shows a **read-only summary of the currently active
   rule set** (category, target, rate, calculation method) that will be applied — so a Treasurer, who
   can trigger generation but not edit configuration, is never generating bills blind to what's
   configured.
2. Before committing to a full run, `GET .../preview?flatId=` computes the same resolution +
   calculation for **one sample flat without persisting anything** — a dry run so a mistake in a
   newly added/revised rule is caught before it's baked into every resident's bill (worth this extra
   endpoint specifically *because* step 4 blocks silent regeneration).
3. `POST .../generate` runs, per active `Flat` in the society:
   - Resolve every active `MaintenanceChargeRule` whose `EffectiveFrom..EffectiveTo` window covers
     the cycle's period and whose target resolves to this flat (§2.4).
   - Subtract anything covered by an active `MaintenanceExemption` whose target also resolves to
     that flat, for the same category.
   - Compute each remaining rule's amount via its `ICalculationStrategy`.
   - Insert one `MaintenanceBillLineItem` per rule, sum into one `MaintenanceBill` for that flat +
     cycle.
4. The whole run is one DB transaction per flat (or one large transaction for the cycle, size
   depending); regenerating an already-`Generated` cycle is blocked by default — an explicit
   "regenerate" path would void the old bills' line items and rebuild, flagged as phase 2.
5. Cycle status moves `Draft → Generated`; a separate `Publish` action flips bills from an internal
   state to resident-visible, so a Treasurer can review before residents see amounts.

For now this runs synchronously inside the request (matches the app's current simplicity); if a
society's flat count makes this slow, the natural next step is a background/queued job — noted as a
scaling path, not built now.

## 7. Validation rules

- `CategoryName`/`TypeName`/`AmenityName`/`GroupName` unique per society (enforced by DB unique index
  + a friendly pre-check in the service, same pattern as `ResidentService`'s email-uniqueness check).
- `MaintenanceChargeRule`: `EffectiveFrom` required; `EffectiveTo` (if set) ≥ `EffectiveFrom`; no two
  *active* rules may overlap for the same `CategoryId` + `ChargeTargetTypeId` + `TargetId` — enforced
  in the service (business rule, not a DB constraint, since it depends on date-range overlap logic).
- `Rate` ≥ 0.
- Deleting (not deactivating) a `MaintenanceCategory`/`MaintenanceChargeRule`/`ParkingType`/`Amenity`/
  `FlatGroup` is only allowed when **no bill line item references it yet** — otherwise the service
  returns a friendly `ServiceResult.Fail("Cannot delete — bills already reference this configuration.
  Deactivate it instead.")`, exactly like `ResidentService.DeleteAsync`'s FK-conflict handling.
  Deactivation (`IsActive = false`) is always available and is the recommended way to retire a
  category/rule that has billing history.

## 8. Role-based authorization

Reuses the existing role model — no new roles needed:

- **SuperAdmin**: manages the two global reference tables in §2.1 (`CalculationMethod`,
  `ChargeTargetType`) only (pairs with code deploys for new calculation shapes or target kinds).
- **Admin** (per society): full CRUD over all of §2.2 (categories, billing frequencies, parking
  types, amenities, flat groups, charge rules, exemptions), plus toggling which of the global
  `ChargeTargetType` kinds are enabled for their own society (`SocietyChargeTargetType`) — this is
  the literal "Society Administrator configures maintenance categories..." requirement.
- **Treasurer**: can trigger bill generation/publish (`RoleNames.BillingRoles`, §4/§5) and record
  payments (finance-oriented committee role already defined in `RoleNames`), but not edit
  category/rule configuration — a reasonable separation of duties, flagged in §11 as adjustable if
  the user wants Treasurer to also configure rules.
- **Chairman/Secretary**: read access to configuration and bills, **including the billing-cycle page
  itself** — they can see the active rule summary and drill into any bill, same as Admin/Treasurer —
  but the `Generate`/`Publish` **action buttons** on that page are conditionally rendered only for
  `RoleNames.BillingRoles`, the same "page open to committee, actions gated tighter" idiom already
  used in `ResidentList.jsx` (`isCommitteeRole` controls the Add/Edit/Delete buttons, not page
  access). This resolves what would otherwise be a contradiction between "Chairman/Secretary can
  read bills" (true) and "only Admin/Treasurer can generate" (also true) — it's a view/action
  distinction, not a page-level block. No write access to category/rule configuration, same
  reasoning as below — Admin-only, to keep a single accountable owner per society, matching how
  `AdminUsersController` is Admin-only today.
- **Resident**: read-only access to their own flat's bills and the society's active amenity/parking
  charge list (so they understand what they're being billed for) — never another flat's data, never
  another society's data (enforced the same way `ResidentService.ListAsync` already returns `[]` for
  a `null` `SocietyId` context, e.g. a stray SuperAdmin call).
- **Security**: no access to this module.

Tenant isolation is absolute regardless of role: every query filters by `currentUser.SocietyId`, so
even an Admin from Society A can never see or modify Society B's maintenance configuration — this is
enforced at the service layer (not just UI hiding), the same guarantee already proven for
Residents/Flats/Users during the multi-tenancy work.

## 9. Audit logging

Every mutating call in every new service (create/update/deactivate/delete/revise, across categories,
rules, parking types, amenities, flat groups, exemptions, billing cycles) writes one row via the new
`AuditLogService` into the existing `AuditLog` table (`SocietyId`, `Action`, `TableName`, `RecordId`,
`Details`, `UserId`, `CreatedOn` — all columns already exist). This reuses infrastructure instead of
inventing a parallel audit mechanism, and gives a Society Admin (or SuperAdmin investigating a
dispute) a full "who changed what, when" trail for every bylaw/rate change.

## 10. Portal workflow (frontend)

**This needs a new nav/routing concept the app doesn't have yet, and the plan should say so
explicitly rather than leave it implicit.** Every real module so far (Residents, Flats, Users,
Societies) is one `dashboardNav.js` key → one page. This module has 7+ sub-areas, and
`getVisibleNavItems()` (`dashboardNav.js`) only supports show/hide-by-role for a single path per
key — there's no sub-nav/tab concept anywhere in the app today, so this is genuinely new frontend
infrastructure, not a reuse of an existing pattern:

- The `maintenance` `NAV_ITEMS` entry gets a `roles` array excluding `Security` (today it has none,
  so — per the current `societyScoped: true`, no-`roles` shape — every non-SuperAdmin role including
  Security sees it, which is wrong per §8).
- The single `/dashboard/maintenance` route renders a small **role-branching landing component**
  (same `isCommitteeRole`/role-check idiom `ResidentList.jsx`/`FlatList.jsx` already use for
  conditional UI, just applied to the whole page instead of a button): committee roles land on a
  tabbed/linked "Maintenance Configuration" hub; a Resident is routed straight to "My Bills" — one nav
  key can't correctly send an Admin and a Resident to two different default screens otherwise.
- **First-time setup checklist (new — not present in earlier draft, added for Admin onboarding
  ease).** The configuration hub's landing view is a simple checklist (Categories set up? Billing
  frequencies? Parking types? Amenities? Flat groups? At least one charge rule per category?) with a
  done/not-done indicator per step, linking into the relevant sub-page in a sensible order — so a
  brand-new society's Admin isn't guessing which of 7 pages to visit first. This same landing view
  hosts a small **target-type toggle panel** (6 on/off switches, one per `ChargeTargetType` — no
  add/edit/delete, just `PUT .../enablement`, §5) rather than a full separate CRUD page, since it's
  fixed at 6 kinds. Sub-pages themselves:
  - `/dashboard/maintenance/categories` — Category list + Add/Edit modal.
  - `/dashboard/maintenance/billing-frequencies` — list + modal, same shape as Categories (new — this
    module was global read-only in an earlier draft, now a normal per-society config page).
  - `/dashboard/maintenance/charge-rules` — Rules list (filterable by category), Add/"Revise rate"
    modal showing calculation method, target, rate, effective dates. The target-type picker only
    offers kinds enabled for this society (`SocietyChargeTargetType`) — see the toggle panel below.
  - `/dashboard/maintenance/parking-types`, `/dashboard/maintenance/amenities` — same list+modal
    shape; Amenities list links through to a subscriptions sub-view for opt-in amenities.
  - `/dashboard/maintenance/flat-groups` — list + modal, with a flat-picker for group membership.
  - `/dashboard/maintenance/exemptions` — list + modal, target-type picker (flat or group, §2.2).
  - `/dashboard/maintenance/billing` — billing cycle list + active-rule summary (readable by all
    committee roles) with `Generate`/`Publish`/`Preview` buttons conditionally rendered only for
    `RoleNames.BillingRoles` (§8) — not a page-level `RequireRole` block.
- **Resident-facing pages** (not gated behind the committee hub):
  - `/dashboard/maintenance/my-charges` (new — not present in earlier draft) — plain-language "what
    applies to my flat" view, listing each active category/rate/basis (e.g. "Water Charges — ₹0.50 /
    sq ft × 1000 sq ft") **before** a bill is even generated for the next cycle, not just a historical
    line-item dump after the fact. Reduces Resident confusion and Admin/Treasurer support load
    explaining bill contents.
  - `/dashboard/maintenance/my-bills` — historical bills with line-item breakdown, reusing the same
    page for committee roles but showing all flats (filter by flat for committee, forced to own flat
    for Resident, per §5's read-access row).

All configuration pages are Admin-only via `RequireRole`, exactly like `admin/users`/`societies`
today; the billing page is open to `RoleNames.CommitteeRoles` for viewing with narrower
`RoleNames.BillingRoles` action-button gating (§8); resident-facing pages are open to any
authenticated society member, each forced server-side to their own flat's data.

## 11. Explicitly flagged open decisions (confirm before implementation starts)

1. **Amenity subscriptions scoped to Flat, not individual Resident** — matches how billing already
   works at flat level. If per-member gym billing within a shared flat is actually needed, that's an
   `AmenitySubscription.ResidentId` addition, phase 2.
2. **Treasurer can generate/publish bills (`RoleNames.BillingRoles`) but not edit rate
   configuration (Admin-only)**; Chairman/Secretary can view configuration and bills but not
   generate/publish or edit (§8) — flag if the user wants any of these three splits adjusted.
3. **No background job / queue for bill generation yet** — synchronous, matching the app's current
   complexity level. Revisit if a society's flat count makes generation slow.
4. **No multi-bill payment allocation (`PaymentAllocation`) yet** — a partial payment applies to the
   one bill it's recorded against, same as today's `Payment` table. Flagged as phase 2.
5. **Formula calculation method** uses a sandboxed expression evaluator over a fixed variable
   whitelist (not arbitrary code execution) — needs a concrete library choice at implementation time
   (e.g. NCalc for .NET) or a small hand-rolled parser if a dependency is undesired.
6. **CONFIRMED**: "Define calculation methods" means "choose and parameterize an existing method for
   a rule," not "invent new calculation algorithms." Calculation method *types* (FixedAmount,
   PerSqFt, Formula, etc.) stay a small global, SuperAdmin-owned, code-paired list (§2.1/§3); a
   Society Admin fully owns picking one and setting its rate/parameters/target/effective dates per
   `MaintenanceChargeRule` — which covers every concrete scenario in the request (2W/4W parking
   split, per-sq-ft water charges, percentage-based sinking fund, a brand-new "Fire Audit Charges"
   category, etc.). A related but separate question — *which* of the global `ChargeTargetType` kinds
   a society uses — **is** now per-society (`SocietyChargeTargetType`, §2.1), and billing frequencies
   are now fully per-society too (§2.2) — see the follow-up discussion above §2.1 for how "differ by
   society" was resolved differently for each of the three original global tables.
7. **"Buildings" is treated as synonymous with the existing `Wing` entity.** The request asks how
   categories map to "societies, buildings, wings, flats..." — this app's existing schema only has
   `Society → Wing → Flat` (no separate `Building` table), so this plan's `ChargeTargetType = Wing`
   is doing double duty as "building or wing, whichever a society calls its mid-level grouping." If a
   society actually has multiple physical buildings, each containing multiple wings (a `Society →
   Building → Wing → Flat` hierarchy), that's a distinct data model layer not covered here and would
   need its own `Building` table + an extra `ChargeTargetType` — flagging it now rather than
   discovering the gap mid-implementation.

## 12. Implementation phasing (respecting this project's one-module-at-a-time discipline)

0. **Phase 0 — Prerequisite entities** (§4): `Parking.cs` + `ParkingTypeId` column, `AuditLog.cs` —
   neither exists as an EF entity yet despite the DB tables already being there. Small, but blocks
   Phase 1's parking-type resolution and Phase 1's audit logging if skipped.
1. **Phase 1 — Masters**: the two global reference tables (`CalculationMethod`, `ChargeTargetType`)
   must be created here, not Phase 2 — `SocietyChargeTargetType` (also seeded in this phase) FKs to
   `ChargeTargetType`, so the reference table has to exist first. Alongside them: `MaintenanceCategory`,
   `BillingFrequency`, `ParkingType`, `Amenity`, `FlatGroup` (+ member mapping) — entities, services,
   controllers, list+modal UI, no billing yet. Seed the starter category/frequency lists per new
   society. Includes the nav/routing rework (§10: role-branching landing page, `roles` array on the
   `maintenance` nav entry, first-time setup checklist, target-type toggle panel +
   `SocietyChargeTargetType` seeding).
2. **Phase 2 — Rules & rates**: `MaintenanceChargeRule` (+ calculation strategies, resolved against
   the `CalculationMethod` rows seeded in Phase 1), `MaintenanceExemption` (flat-or-group targeting),
   `AmenitySubscription` — the "assign charges to flats/groups/parking/amenities with effective
   dates" requirement. Includes the Resident-facing "My Charges" plain-language view (§10), since it
   only needs rules to exist, not billing.
3. **Phase 3 — Billing engine**: `MaintenanceBillingCycle`, `MaintenanceBillLineItem`, the
   `MaintenanceBill` migration, generation/preview/publish workflow (§6), `RoleNames.BillingRoles`.
4. **Phase 4 — Resident-facing bills & payments**: "My Bills" view, payment recording against the
   existing `Payment` table/flow.

Each phase is built, migrated, and verified end-to-end (API + browser) before the next starts —
same discipline already used for Residents, Flats, and the multi-tenancy conversion.
