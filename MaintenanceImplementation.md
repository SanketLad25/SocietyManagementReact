# Maintenance Module — Step-by-Step Implementation Guide

This is the **execution checklist** for the design in `maintenance.md`. That file explains *why*;
this file is the ordered *how*, down to file names, DDL, and verification commands — the same level
of concreteness used to actually build Residents/Flats/Users/Societies in this project. Read
`maintenance.md` first if a "why" isn't obvious here; it's referenced by section (e.g. `mm §2.2`)
throughout.

**Discipline**: build and verify one phase fully (DB → backend build+API-smoke-test → frontend
build+lint+browser-test) before starting the next, exactly like every module before this one. Don't
skip the verification gates — that's how the `IAuditable`/`ITenantScoped` mismatch and the
`Society.CreatedOn` datetime-range bug got caught during the earlier work, not by review alone.

---

## Phase 0 — Prerequisite entities (code only, no DB migration)

`Parking` and `AuditLog` tables already exist in the DB (with `SocietyId` + audit columns from
`003_multi_tenant_audit.sql`) but have no EF entity yet (`mm §4`). Nothing to migrate — just map what
already exists.

- [ ] **`Models/Entities/Parking.cs`** — plain properties matching the current DB columns exactly:
  `ParkingId (PK)`, `SocietyId`, `FlatId (nullable)`, `ParkingNo`, `VehicleNo`, `VehicleType`,
  `CreatedOn`, `CreatedBy`, `ModifiedOn`, `ModifiedBy`. Implements `ITenantScoped` (has `SocietyId` +
  full audit set, same as `Resident`/`Flat`).
- [ ] **`Models/Entities/AuditLog.cs`** — `AuditLogId (PK)`, `SocietyId`, `UserId (nullable)`,
  `Action`, `TableName`, `RecordId (nullable)`, `Details`, `CreatedOn`. Implements **neither**
  `ITenantScoped` nor `IAuditable` (`mm §2.5`) — it has `UserId` instead of `CreatedBy` and no
  `ModifiedOn`/`ModifiedBy` at all (insert-only log).
- [ ] Map both in `Data/SocietyDbContext.cs`: add `DbSet<Parking> Parkings` / `DbSet<AuditLog> AuditLogs`,
  Fluent `ToTable`/`HasKey`/`HasMaxLength` entries in `OnModelCreating`, matching the existing style
  for `Resident`/`Flat`. `AuditLog` needs no `SaveChangesAsync` auto-stamp handling since it isn't
  `IAuditable` — every insert into it sets `SocietyId`/`CreatedOn` explicitly (this is exactly what
  `AuditLogService`, built in Phase 1, will do).
- [ ] `dotnet build` — must succeed with zero errors before continuing. No new endpoints yet, so no
  API smoke test; just confirm the app still starts (`dotnet run --launch-profile http`, hit
  `POST /api/auth/login` once) to prove the new mappings didn't break `OnModelCreating`.

---

## Phase 1 — Masters (Categories, Billing Frequencies, Parking Types, Amenities, Flat Groups)

### 1.1 Database — `database/004_maintenance_masters.sql`

New migration file, same conventions as `003_multi_tenant_audit.sql` (`SET QUOTED_IDENTIFIER ON`
near the top since filtered/unique indexes are used; `GO` between any `ALTER TABLE ADD` and a
statement that references the new column).

```sql
USE [Society Management];
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- Global reference tables (mm §2.1) — not per-society, same status as Role.
-- ============================================================================
CREATE TABLE CalculationMethod (
    CalculationMethodId INT PRIMARY KEY IDENTITY,
    MethodCode VARCHAR(30) NOT NULL,
    MethodName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(300) NULL,
    ParametersSchema NVARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_CalculationMethod_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT UX_CalculationMethod_MethodCode UNIQUE (MethodCode)
);
GO
ALTER TABLE CalculationMethod ADD CONSTRAINT FK_CalculationMethod_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE CalculationMethod ADD CONSTRAINT FK_CalculationMethod_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

CREATE TABLE ChargeTargetType (
    ChargeTargetTypeId INT PRIMARY KEY IDENTITY,
    Code VARCHAR(30) NOT NULL,
    Label NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ChargeTargetType_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT UX_ChargeTargetType_Code UNIQUE (Code)
);
-- Note: mm's original table sketch for ChargeTargetType omitted audit columns; added here for
-- consistency with every other table (including CalculationMethod right next to it) — an oversight
-- caught while writing this migration, not a deliberate exception.
GO
ALTER TABLE ChargeTargetType ADD CONSTRAINT FK_ChargeTargetType_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE ChargeTargetType ADD CONSTRAINT FK_ChargeTargetType_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- Per-society enablement toggle over the global ChargeTargetType list (mm §2.1).
-- ============================================================================
CREATE TABLE SocietyChargeTargetType (
    SocietyChargeTargetTypeId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    ChargeTargetTypeId INT NOT NULL,
    IsEnabled BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_SocietyChargeTargetType_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_SocietyChargeTargetType_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_SocietyChargeTargetType_ChargeTargetType FOREIGN KEY (ChargeTargetTypeId) REFERENCES ChargeTargetType(ChargeTargetTypeId),
    CONSTRAINT UX_SocietyChargeTargetType UNIQUE (SocietyId, ChargeTargetTypeId)
);
GO
CREATE INDEX IX_SocietyChargeTargetType_SocietyId ON SocietyChargeTargetType(SocietyId);
GO
ALTER TABLE SocietyChargeTargetType ADD CONSTRAINT FK_SocietyChargeTargetType_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE SocietyChargeTargetType ADD CONSTRAINT FK_SocietyChargeTargetType_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- MaintenanceCategory (mm §2.2)
-- ============================================================================
CREATE TABLE MaintenanceCategory (
    CategoryId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    CategoryCode VARCHAR(30) NULL,
    Description NVARCHAR(300) NULL,
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_MaintenanceCategory_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_MaintenanceCategory_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT UX_MaintenanceCategory_Name UNIQUE (SocietyId, CategoryName)
);
GO
CREATE INDEX IX_MaintenanceCategory_SocietyId ON MaintenanceCategory(SocietyId);
GO
ALTER TABLE MaintenanceCategory ADD CONSTRAINT FK_MaintenanceCategory_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE MaintenanceCategory ADD CONSTRAINT FK_MaintenanceCategory_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- BillingFrequency — fully per-society (mm §2.2, moved here after the follow-up review)
-- ============================================================================
CREATE TABLE BillingFrequency (
    BillingFrequencyId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    Label NVARCHAR(50) NOT NULL,
    IntervalMonths INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_BillingFrequency_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_BillingFrequency_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT UX_BillingFrequency_Label UNIQUE (SocietyId, Label)
);
GO
CREATE INDEX IX_BillingFrequency_SocietyId ON BillingFrequency(SocietyId);
GO
ALTER TABLE BillingFrequency ADD CONSTRAINT FK_BillingFrequency_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE BillingFrequency ADD CONSTRAINT FK_BillingFrequency_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- ParkingType (mm §2.2)
-- ============================================================================
CREATE TABLE ParkingType (
    ParkingTypeId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    TypeName NVARCHAR(50) NOT NULL,
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ParkingType_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_ParkingType_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT UX_ParkingType_Name UNIQUE (SocietyId, TypeName)
);
GO
CREATE INDEX IX_ParkingType_SocietyId ON ParkingType(SocietyId);
GO
ALTER TABLE ParkingType ADD CONSTRAINT FK_ParkingType_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE ParkingType ADD CONSTRAINT FK_ParkingType_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- Existing Parking table gets a companion typed FK now that ParkingType exists (mm §2.2) — additive,
-- VehicleType free-text column stays as a display fallback, not dropped.
ALTER TABLE Parking ADD ParkingTypeId INT NULL;
GO
ALTER TABLE Parking ADD CONSTRAINT FK_Parking_ParkingType FOREIGN KEY (ParkingTypeId) REFERENCES ParkingType(ParkingTypeId);
GO
CREATE INDEX IX_Parking_ParkingTypeId ON Parking(ParkingTypeId);
GO

-- ============================================================================
-- Amenity + AmenitySubscription table shape is created in Phase 2 (needs MaintenanceCategory
-- only for reporting, not billing) — Amenity itself is a Phase 1 master, subscription is Phase 2.
-- ============================================================================
CREATE TABLE Amenity (
    AmenityId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    AmenityName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(300) NULL,
    RequiresOptIn BIT NOT NULL DEFAULT 0,
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Amenity_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_Amenity_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT UX_Amenity_Name UNIQUE (SocietyId, AmenityName)
);
GO
CREATE INDEX IX_Amenity_SocietyId ON Amenity(SocietyId);
GO
ALTER TABLE Amenity ADD CONSTRAINT FK_Amenity_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Amenity ADD CONSTRAINT FK_Amenity_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- FlatGroup / FlatGroupMember (mm §2.2)
-- ============================================================================
CREATE TABLE FlatGroup (
    FlatGroupId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    GroupName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(300) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_FlatGroup_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_FlatGroup_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT UX_FlatGroup_Name UNIQUE (SocietyId, GroupName)
);
GO
CREATE INDEX IX_FlatGroup_SocietyId ON FlatGroup(SocietyId);
GO
ALTER TABLE FlatGroup ADD CONSTRAINT FK_FlatGroup_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE FlatGroup ADD CONSTRAINT FK_FlatGroup_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

CREATE TABLE FlatGroupMember (
    FlatGroupId INT NOT NULL,
    FlatId INT NOT NULL,
    SocietyId INT NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_FlatGroupMember_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT PK_FlatGroupMember PRIMARY KEY (FlatGroupId, FlatId),
    CONSTRAINT FK_FlatGroupMember_FlatGroup FOREIGN KEY (FlatGroupId) REFERENCES FlatGroup(FlatGroupId),
    CONSTRAINT FK_FlatGroupMember_Flat FOREIGN KEY (FlatId) REFERENCES Flat(FlatId),
    CONSTRAINT FK_FlatGroupMember_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId)
);
GO
ALTER TABLE FlatGroupMember ADD CONSTRAINT FK_FlatGroupMember_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE FlatGroupMember ADD CONSTRAINT FK_FlatGroupMember_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO
```

- [ ] Run against the dev DB: `sqlcmd -S localhost -E -C -i "database\004_maintenance_masters.sql"`
  — same tool/flags used for `003_multi_tenant_audit.sql`. Watch for the same
  `QUOTED_IDENTIFIER`/batch-boundary gotchas hit last time; if a statement fails partway, check what
  actually landed (`sys.columns`/`sys.indexes` queries, same approach as before) before re-running,
  since identity gaps from a failed attempt are harmless but re-running a `CREATE TABLE` is not.
- [ ] Verify: every new table exists, `Parking.ParkingTypeId` column + FK exist, no orphaned
  half-applied state.

### 1.2 Backend — entities, DbContext, seeders

- [ ] **Entities** (`Models/Entities/`): `CalculationMethod.cs`, `ChargeTargetType.cs`,
  `SocietyChargeTargetType.cs` (implements `ITenantScoped`), `MaintenanceCategory.cs` (implements
  `ITenantScoped`), `BillingFrequency.cs` (implements `ITenantScoped`), `ParkingType.cs` (implements
  `ITenantScoped`), `Amenity.cs` (implements `ITenantScoped`), `FlatGroup.cs`/`FlatGroupMember.cs`
  (implement `ITenantScoped`). `CalculationMethod`/`ChargeTargetType` implement `IAuditable` only
  (no `SocietyId` — global, `mm §2.1`).
- [ ] Add `ParkingTypeId` (nullable int) to `Models/Entities/Parking.cs` (built in Phase 0).
- [ ] Map every new entity in `SocietyDbContext.OnModelCreating` (`ToTable`/`HasKey`/`HasMaxLength`/
  `HasOne<Society>().WithMany().HasForeignKey(...)` for the tenant-scoped ones), same shape as the
  existing `Flat`/`Resident` blocks. Add each `DbSet<T>`.
- [ ] **`Data/MaintenanceReferenceSeeder.cs`** (new, same idiom as `DbSeeder.SeedRolesAsync`):
  - `SeedGlobalReferenceDataAsync(db)` — inserts the 6 `CalculationMethod` rows (`FixedAmount`,
    `PerSqFt`, `PerUnit`, `SlabTiered`, `PercentageOfCategory`, `Formula`) and the 6
    `ChargeTargetType` rows (`AllFlats`, `Wing`, `FlatGroup`, `SpecificFlat`, `ParkingType`,
    `Amenity`) if missing — idempotent, same "insert if not already present" pattern as
    `SeedRolesAsync`.
  - `BackfillExistingSocietiesAsync(db)` — for every `Society` with zero `MaintenanceCategory` rows
    (i.e. it predates this feature), seed: the starter category list (`mm §2.2`'s eleven names), the
    starter `BillingFrequency` list (Monthly/Quarterly/Half-Yearly/Annually/One-Time with
    `IntervalMonths` 1/3/6/12/0), and one `SocietyChargeTargetType` row per `ChargeTargetType`
    (`IsEnabled = 1`). This catches "Shubhangi CHSL" and any society created before this phase
    shipped; newly created societies going forward get the same three seeds synchronously (next
    bullet).
- [ ] **`SocietyService.CreateAsync`**: after a new `Society` is saved, call the same three seed
  steps (category list, billing-frequency list, target-type-toggle rows) for that one new
  `SocietyId` — so a SuperAdmin onboarding a brand-new society gets it immediately, not on next
  restart.
- [ ] Wire into `Program.cs` right after the existing seed calls:
  ```csharp
  await MaintenanceReferenceSeeder.SeedGlobalReferenceDataAsync(db);
  await MaintenanceReferenceSeeder.BackfillExistingSocietiesAsync(db);
  ```

### 1.3 Backend — DTOs, services, controllers

- [ ] DTOs in `Models/Dtos/`: `MaintenanceCategoryRequest`/`Response`, `BillingFrequencyRequest`/
  `Response`, `ParkingTypeRequest`/`Response`, `AmenityRequest`/`Response`, `FlatGroupRequest`/
  `Response` (+ a small `FlatGroupMemberRequest` for add/remove-member calls),
  `ChargeTargetTypeResponse` (includes `isEnabledForSociety` computed field, `mm §5`).
- [ ] Services in `Services/`, each `(SocietyDbContext db, ICurrentUserContext currentUser)`,
  list/get/create/update/deactivate shaped exactly like `FlatService`: `MaintenanceCategoryService`,
  `BillingFrequencyService`, `ParkingTypeService`, `AmenityService`, `FlatGroupService` (+ member
  add/remove methods). Plus `ChargeTargetTypeService` (read-only global list annotated per-society,
  and `SetEnablementAsync(chargeTargetTypeId, isEnabled)` writing to `SocietyChargeTargetType`).
- [ ] **`Services/AuditLogService.cs`** (new): `LogAsync(string action, string tableName, int?
  recordId, string details)` — reads `SocietyId`/`UserId` off `ICurrentUserContext`, inserts one
  `AuditLog` row directly (bypassing `SaveChangesAsync`'s auto-stamp loop, since `AuditLog` isn't
  `IAuditable` — set `CreatedOn = DateTime.UtcNow` explicitly). Call it from every mutating method in
  every service above (`mm §9`).
- [ ] Controllers in `Controllers/`: `MaintenanceCategoriesController`, `BillingFrequenciesController`,
  `ParkingTypesController`, `AmenitiesController`, `FlatGroupsController`, `ChargeTargetTypesController`
  — `[Authorize]` reads open to any authenticated society member (`mm §5`), writes
  `[Authorize(Roles = RoleNames.Admin)]`.
- [ ] Register every new service in `Program.cs` (`builder.Services.AddScoped<...>()`).
- [ ] `dotnet build` — zero errors.

### 1.4 Backend verification (API smoke test against the real dev DB)

Same pattern used for Flats: start the backend, log in, exercise each new endpoint.

- [ ] Start: `dotnet run --launch-profile http` from `SociectyManagementCore/`.
- [ ] Log in as an existing Admin (`Test Towers`/`pwadmin` or similar from earlier sessions).
- [ ] `GET /api/maintenance/categories` — confirm the eleven starter categories appear (proves the
  backfill seeder ran for this pre-existing society).
- [ ] `GET /api/maintenance/billing-frequencies` — confirm the five starter frequencies appear.
- [ ] `GET /api/maintenance/charge-target-types` — confirm all 6 appear with `isEnabledForSociety: true`.
- [ ] `PUT /api/maintenance/charge-target-types/{id}/enablement` with `{ isEnabled: false }` for
  `ParkingType` — then re-`GET` and confirm it flipped, and flip it back.
- [ ] `POST`/`PUT` a `MaintenanceCategory`, a `ParkingType`, an `Amenity`, a `FlatGroup` — confirm
  creation, duplicate-name rejection (409), and that a second society's Admin sees none of the first
  society's rows (tenant isolation, same check style used for Flats).
- [ ] Confirm one `AuditLog` row was written per mutation (`SELECT * FROM AuditLog ORDER BY
  AuditLogId DESC`).

### 1.5 Frontend

- [ ] `src/api/maintenanceCategories.js`, `billingFrequencies.js`, `parkingTypes.js`, `amenities.js`,
  `flatGroups.js`, `chargeTargetTypes.js` — thin wrappers, same shape as `src/api/flats.js`.
- [ ] `src/pages/maintenance/` — one List page + one Form component per resource, using the
  **popup `Modal`** pattern (`src/components/Modal.jsx`), exactly like `FlatList.jsx`/`FlatForm.jsx`:
  `CategoryList`/`CategoryForm`, `BillingFrequencyList`/`Form`, `ParkingTypeList`/`Form`,
  `AmenityList`/`Form`, `FlatGroupList`/`Form` (with a flat-picker for membership, `mm §10`).
- [ ] **`src/pages/maintenance/MaintenanceHub.jsx`** (new) — the role-branching landing page (`mm
  §10`): for committee roles, a setup checklist (done/not-done per master) linking into each list
  page above, plus the 6-switch `ChargeTargetType` enablement toggle panel; for a Resident, this
  component immediately renders/redirects to "My Charges" (built in Phase 2) instead.
- [ ] **`src/config/dashboardNav.js`**: give the existing `maintenance` entry a `roles` array
  excluding `Security` (today it has none — every non-SuperAdmin role including Security currently
  sees it, which `mm §8` says is wrong).
- [ ] **`src/App.jsx`**: point `/dashboard/maintenance` at `MaintenanceHub`; add routes for
  `maintenance/categories`, `maintenance/billing-frequencies`, `maintenance/parking-types`,
  `maintenance/amenities`, `maintenance/flat-groups`, each `RequireRole roles={['Admin']}`. Move
  `maintenance` out of `PLACEHOLDER_ITEMS`/`REAL_PAGE_KEYS` the same way `flats` was turned from a
  `ComingSoon` placeholder into a real page.
- [ ] `npm run build` + `npm run lint` — zero errors.
- [ ] Browser verification (Playwright, same pattern as the Flats/modal verification runs): log in
  as an Admin, land on the Maintenance hub, see the checklist and existing seeded data, add/edit one
  row in each of the five list pages via modal (confirm list updates in place, no navigation), toggle
  a `ChargeTargetType` off and back on, confirm a Resident session lands somewhere sensible (My
  Charges placeholder is fine until Phase 2) instead of the committee hub, confirm Security has no
  `Maintenance` nav item at all.

---

## Phase 2 — Rules & rates (assign charges, effective dates, exemptions, amenity opt-ins)

### 2.1 Database — `database/005_maintenance_rules.sql`

```sql
USE [Society Management];
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE MaintenanceChargeRule (
    RuleId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    CategoryId INT NOT NULL,
    CalculationMethodId INT NOT NULL,
    ChargeTargetTypeId INT NOT NULL,
    TargetId INT NULL,
    Rate DECIMAL(12,2) NOT NULL,
    ParametersJson NVARCHAR(MAX) NULL,
    BillingFrequencyId INT NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_MaintenanceChargeRule_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_MaintenanceChargeRule_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_MaintenanceChargeRule_Category FOREIGN KEY (CategoryId) REFERENCES MaintenanceCategory(CategoryId),
    CONSTRAINT FK_MaintenanceChargeRule_Method FOREIGN KEY (CalculationMethodId) REFERENCES CalculationMethod(CalculationMethodId),
    CONSTRAINT FK_MaintenanceChargeRule_TargetType FOREIGN KEY (ChargeTargetTypeId) REFERENCES ChargeTargetType(ChargeTargetTypeId),
    CONSTRAINT FK_MaintenanceChargeRule_Frequency FOREIGN KEY (BillingFrequencyId) REFERENCES BillingFrequency(BillingFrequencyId)
    -- TargetId is deliberately NOT FK-enforced (mm §2.2) — polymorphic across Wing/FlatGroup/Flat/ParkingType/Amenity.
);
GO
CREATE INDEX IX_MaintenanceChargeRule_Lookup ON MaintenanceChargeRule(SocietyId, CategoryId, ChargeTargetTypeId, TargetId, EffectiveFrom);
GO
ALTER TABLE MaintenanceChargeRule ADD CONSTRAINT FK_MaintenanceChargeRule_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE MaintenanceChargeRule ADD CONSTRAINT FK_MaintenanceChargeRule_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

CREATE TABLE MaintenanceExemption (
    ExemptionId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    CategoryId INT NOT NULL,
    ChargeTargetTypeId INT NOT NULL,
    TargetId INT NULL,
    Reason NVARCHAR(300) NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_MaintenanceExemption_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_MaintenanceExemption_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_MaintenanceExemption_Category FOREIGN KEY (CategoryId) REFERENCES MaintenanceCategory(CategoryId),
    CONSTRAINT FK_MaintenanceExemption_TargetType FOREIGN KEY (ChargeTargetTypeId) REFERENCES ChargeTargetType(ChargeTargetTypeId)
);
GO
CREATE INDEX IX_MaintenanceExemption_SocietyId ON MaintenanceExemption(SocietyId);
GO
ALTER TABLE MaintenanceExemption ADD CONSTRAINT FK_MaintenanceExemption_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE MaintenanceExemption ADD CONSTRAINT FK_MaintenanceExemption_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

CREATE TABLE AmenitySubscription (
    SubscriptionId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    AmenityId INT NOT NULL,
    FlatId INT NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_AmenitySubscription_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_AmenitySubscription_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_AmenitySubscription_Amenity FOREIGN KEY (AmenityId) REFERENCES Amenity(AmenityId),
    CONSTRAINT FK_AmenitySubscription_Flat FOREIGN KEY (FlatId) REFERENCES Flat(FlatId)
);
GO
CREATE INDEX IX_AmenitySubscription_Lookup ON AmenitySubscription(SocietyId, AmenityId, FlatId);
GO
ALTER TABLE AmenitySubscription ADD CONSTRAINT FK_AmenitySubscription_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE AmenitySubscription ADD CONSTRAINT FK_AmenitySubscription_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO
```

- [ ] Run against dev DB, verify tables/FKs/indexes exist.

### 2.2 Backend — calculation engine

- [ ] **`Services/Calculation/ICalculationStrategy.cs`** (`mm §3`):
  ```csharp
  public interface ICalculationStrategy
  {
      string MethodCode { get; }
      decimal Calculate(MaintenanceChargeRule rule, FlatBillingContext context);
  }
  ```
- [ ] **`Services/Calculation/FlatBillingContext.cs`** — carries `Flat` (for `AreaSqFt`), a unit-count
  resolver (parking slots of a given `ParkingType` at this flat), and a same-cycle category-amount
  resolver (for `PercentageOfCategory`).
- [ ] One class per method: `FixedAmountStrategy`, `PerSqFtStrategy`, `PerUnitStrategy`,
  `SlabTieredStrategy`, `PercentageOfCategoryStrategy`, `FormulaStrategy` (the last needs the
  sandboxed expression evaluator — pick a library now, `mm §11.5`, e.g. NCalc).
  `MethodCode` on each matches the seeded `CalculationMethod.MethodCode` value exactly.
- [ ] **`Services/Calculation/CalculationStrategyFactory.cs`** — resolves the right strategy by
  `MethodCode` (inject all `ICalculationStrategy` implementations via DI, `services.AddScoped
  <IEnumerable<ICalculationStrategy>>` is automatic if each is registered individually — register
  all six in `Program.cs`).
- [ ] **`Services/MaintenanceTargetResolver.cs`** (new) — the piece that resolves
  `ChargeTargetTypeId` + `TargetId` → the actual set of `FlatId`s (`mm §2.4`): `AllFlats` → every
  active flat in the society; `Wing` → `Flat.WingId = TargetId`; `FlatGroup` → join
  `FlatGroupMember`; `SpecificFlat` → `TargetId` itself; `ParkingType` → `Parking.ParkingTypeId =
  TargetId` → `Parking.FlatId`; `Amenity` → active `AmenitySubscription` rows for that `AmenityId`.
  Both `MaintenanceChargeRuleService` (validation) and `MaintenanceBillingService` (Phase 3, bill
  generation) depend on this.

### 2.3 Backend — DTOs, services, controllers

- [ ] DTOs: `MaintenanceChargeRuleRequest`/`Response`, **`ReviseChargeRuleRequest`** (narrower —
  `Rate`/`ParametersJson`/`EffectiveFrom` only, `mm §4`), `MaintenanceExemptionRequest`/`Response`,
  `AmenitySubscriptionRequest`/`Response`.
- [ ] `Services/MaintenanceChargeRuleService.cs`: `ListAsync(categoryId?)`, `CreateAsync` (validates
  `TargetId` against the resolved target type — e.g. `FlatGroup` `TargetId` must belong to a real
  `FlatGroup` in this society, `mm §2.2`'s "not FK-enforced, validated in service" note — and checks
  the effective-date-overlap rule, `mm §7`), `ReviseAsync(ruleId, ReviseChargeRuleRequest)` (closes
  the current rule's `EffectiveTo`, inserts the new version — never edits `Rate` in place, `mm §2.2`).
- [ ] `Services/MaintenanceExemptionService.cs`, `Services/AmenitySubscriptionService.cs` — CRUD,
  same shape.
- [ ] Controllers: `MaintenanceChargeRulesController` (`POST .../revise`, plus a `GET .../my-flat`
  resident-facing endpoint used by "My Charges" — not originally listed here, added since the
  frontend needed a concrete read shape), `MaintenanceExemptionsController`, plus subscription
  endpoints nested under `AmenitiesController` (`.../amenities/{id}/subscriptions`). Read access
  split per `mm §5`: charge rules open to any authenticated society member (needed for "My
  Charges"); exemptions `RoleNames.CommitteeRoles` only; amenity subscriptions
  `RoleNames.CommitteeRoles`-only for both reads and writes in the actual implementation (simpler
  than the originally planned "+ the subscribed resident themself" — a resident's own subscription
  status is surfaced through "My Charges" instead of this endpoint, so self-access here was never
  needed).
- [ ] **`CalculationMethodsController` + `CalculationMethodService`** (not in the original plan —
  caught while building the frontend: `ChargeRuleForm`'s calculation-method dropdown needs a read
  endpoint, and Phase 1 never built one for the global `CalculationMethod` table). Read-only,
  `[Authorize]`, no role restriction — same "global lookup" status as `Role`.
- [ ] Register new services in `Program.cs`. `dotnet build`.

### 2.4 Backend verification

- [ ] Create a `MaintenanceChargeRule` for "Parking Maintenance" targeting one `ParkingType`
  (Two-Wheeler) at a fixed rate; create a second rule for the same category targeting Four-Wheeler
  at a different rate — confirm both coexist (this is the literal 2W/4W scenario from the original
  request).
- [ ] Create a rule with `ChargeTargetType = AllFlats`, then `POST .../revise` with a new rate —
  confirm the old row's `EffectiveTo` closed and a new row appeared, old row untouched otherwise.
- [ ] Try creating two overlapping active rules for the same category+target — confirm the service
  rejects it (`mm §7`).
- [ ] Create a `MaintenanceExemption` targeting a `FlatGroup` — confirm one row covers every flat in
  that group (no per-flat rows needed, the gap caught during the architect review, `mm §2.2`).
- [ ] Subscribe one flat to an opt-in `Amenity`; confirm a different resident cannot read that
  subscription (`mm §5`'s access-scoping fix).

### 2.5 Frontend

- [ ] `src/api/maintenanceChargeRules.js`, `maintenanceExemptions.js`, `amenitySubscriptions.js`.
- [ ] `src/pages/maintenance/ChargeRuleList.jsx`/`ChargeRuleForm.jsx` — list filterable by category;
  the Add modal's target-type dropdown only offers types enabled for this society
  (`SocietyChargeTargetType`, fetched from Phase 1's endpoint); "Edit" opens a **"Revise rate"**
  modal (new rate/effective-from), not a raw field-edit, matching the backend's revise-not-update
  semantics.
- [ ] `src/pages/maintenance/ExemptionList.jsx`/`Form.jsx` — target-type picker limited to
  `SpecificFlat`/`FlatGroup`/`Wing`/`AllFlats`.
- [ ] Amenities list page (Phase 1) gets a "Manage subscriptions" link per opt-in amenity → a small
  subscriber list + add-flat modal.
- [ ] **`src/pages/maintenance/MyCharges.jsx`** (new, Resident-facing, `mm §10`) — plain-language
  "what applies to my flat" view: calls a new read endpoint (`GET
  /api/maintenance/charge-rules/my-flat` or filter client-side from the open charge-rules read
  access) and renders each active category/rate/basis in a sentence, not a raw table.
- [ ] Wire routes in `App.jsx`/nav in `MaintenanceHub.jsx` (Resident branch → `MyCharges`).
- [ ] `npm run build && npm run lint`; Playwright verification: create a 2W/4W parking split as an
  Admin, revise a rate and confirm history isn't lost (check via API), log in as a Resident and
  confirm "My Charges" shows the right categories/rates in plain language.

---

## Phase 3 — Billing engine (cycles, generation, line items)

### 3.1 Database — `database/006_maintenance_billing.sql`

```sql
USE [Society Management];
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE MaintenanceBillingCycle (
    CycleId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    CycleLabel NVARCHAR(50) NOT NULL,
    PeriodStart DATE NOT NULL,
    PeriodEnd DATE NOT NULL,
    DueDate DATE NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'Draft',
    GeneratedOn DATETIME NULL,
    GeneratedBy INT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_MaintenanceBillingCycle_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_MaintenanceBillingCycle_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_MaintenanceBillingCycle_GeneratedBy FOREIGN KEY (GeneratedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_MaintenanceBillingCycle_Period UNIQUE (SocietyId, PeriodStart, PeriodEnd)
);
GO
ALTER TABLE MaintenanceBillingCycle ADD CONSTRAINT FK_MaintenanceBillingCycle_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE MaintenanceBillingCycle ADD CONSTRAINT FK_MaintenanceBillingCycle_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- Extend the existing MaintenanceBill table (additive, same style as 003).
ALTER TABLE MaintenanceBill ADD CycleId INT NULL;
GO
ALTER TABLE MaintenanceBill ADD CONSTRAINT FK_MaintenanceBill_Cycle FOREIGN KEY (CycleId) REFERENCES MaintenanceBillingCycle(CycleId);
GO
ALTER TABLE MaintenanceBill ADD OutstandingAmount DECIMAL(10,2) NULL;
GO
ALTER TABLE MaintenanceBill ADD PenaltyAmount DECIMAL(10,2) NULL DEFAULT 0;
GO

CREATE TABLE MaintenanceBillLineItem (
    LineItemId INT PRIMARY KEY IDENTITY,
    SocietyId INT NOT NULL,
    BillId INT NOT NULL,
    RuleId INT NULL,
    CategoryId INT NOT NULL,
    Description NVARCHAR(200) NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_MaintenanceBillLineItem_CreatedOn DEFAULT GETDATE(),
    CONSTRAINT FK_MaintenanceBillLineItem_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_MaintenanceBillLineItem_Bill FOREIGN KEY (BillId) REFERENCES MaintenanceBill(BillId),
    CONSTRAINT FK_MaintenanceBillLineItem_Rule FOREIGN KEY (RuleId) REFERENCES MaintenanceChargeRule(RuleId),
    CONSTRAINT FK_MaintenanceBillLineItem_Category FOREIGN KEY (CategoryId) REFERENCES MaintenanceCategory(CategoryId)
    -- No CreatedBy/ModifiedOn/ModifiedBy — immutable snapshot row, same exception as AuditLog (mm §2.3/§2.5).
);
GO
CREATE INDEX IX_MaintenanceBillLineItem_BillId ON MaintenanceBillLineItem(BillId);
GO
```

- [ ] Run against dev DB, verify.

### 3.2 Backend — `RoleNames.BillingRoles` + billing service

- [ ] `Models/Entities/RoleNames.cs`: add
  `public const string BillingRoles = Admin + "," + Treasurer;` (`mm §4`).
- [ ] `Models/Entities/MaintenanceBillingCycle.cs`, `MaintenanceBillLineItem.cs` (plain class, no
  `ITenantScoped`/`IAuditable`, `mm §2.5`) — map both in `SocietyDbContext`. Extend
  `Models/Entities/MaintenanceBill.cs` with `CycleId`/`OutstandingAmount`/`PenaltyAmount` (create
  this entity now if it doesn't exist yet — it wasn't built for any earlier module).
- [ ] DTOs: `MaintenanceBillingCycleRequest`/`Response`, `MaintenanceBillResponse` (with a nested
  `LineItems: List<MaintenanceBillLineItemResponse>`).
- [ ] **`Services/MaintenanceBillingService.cs`** — the generation engine (`mm §6`):
  - `PreviewAsync(cycleId, flatId)` — runs the resolution+calculation for one flat, returns computed
    line items **without saving anything**.
  - `GenerateAsync(cycleId)` — per active `Flat`: resolve applicable `MaintenanceChargeRule`s via
    `MaintenanceTargetResolver`, subtract `MaintenanceExemption` coverage, compute via
    `CalculationStrategyFactory`, insert `MaintenanceBillLineItem` rows + one summed
    `MaintenanceBill`, all in one transaction per flat. Refuses to run twice on an already-`Generated`
    cycle (`mm §6` step 4).
  - `PublishAsync(cycleId)` — flips cycle + bills to resident-visible.
- [ ] `Controllers/MaintenanceBillingCyclesController.cs` — `[Authorize(Roles =
  RoleNames.CommitteeRoles)]` on the controller (view cycles, active-rule summary), narrower
  `[Authorize(Roles = RoleNames.BillingRoles)]` on `generate`/`publish`/`preview` actions
  specifically (`mm §8` — page open to committee, actions gated tighter).
- [ ] `Controllers/MaintenanceBillsController.cs` — `GET` list/detail; a Resident's `flatId` filter
  is always forced server-side to their own linked flat, never trusted from the query string
  (`mm §5`).
- [ ] Register `MaintenanceBillingService` in `Program.cs`. `dotnet build`.

### 3.3 Backend verification

- [ ] Create a `MaintenanceBillingCycle` in `Draft`.
- [ ] `GET .../preview?flatId=` for one flat — confirm computed line items look right *before*
  generating, confirm nothing was persisted (bill/line-item tables still empty for that flat).
- [ ] `POST .../generate` — confirm one `MaintenanceBill` + correct `MaintenanceBillLineItem` rows
  per flat, amounts match the preview.
- [ ] Re-run `generate` on the same cycle — confirm it's rejected (already `Generated`).
- [ ] `POST .../publish` — confirm a Resident can now `GET` their own bill but still cannot fetch
  another flat's bill by ID (403/404, tenant + ownership check).
- [ ] Confirm a Treasurer (not Admin) can call `generate`/`publish` but a Chairman/Secretary session
  gets 403 on those two actions while still succeeding on the plain `GET` (the `mm §8` view/action
  split).

### 3.4 Frontend

- [ ] `src/api/maintenanceBilling.js` (cycles, generate, preview, publish),
  `src/api/maintenanceBills.js`.
- [ ] `src/pages/maintenance/BillingCycleList.jsx` — cycle list + active-rule summary panel, visible
  to all committee roles; `Generate`/`Preview`/`Publish` buttons conditionally rendered only when
  `session.role` is in `['Admin','Treasurer']` (mirrors backend `RoleNames.BillingRoles`, `mm §10`).
- [ ] `src/pages/maintenance/BillDetail.jsx` — line-item breakdown for one bill (committee: any
  flat; Resident: own flat only, enforced server-side regardless of what the client requests).
- [ ] Wire into `App.jsx`/`MaintenanceHub.jsx`.
- [ ] `npm run build && npm run lint`; Playwright verification: full cycle — create cycle, preview,
  generate, publish, view as Resident, confirm a second society's cycle/bills never appear.

---

## Phase 4 — Resident-facing bills & payments

- [ ] **`src/pages/maintenance/MyBills.jsx`** — historical bills list (own flat only) + drill into
  `BillDetail`.
- [ ] Extend existing `Payment` recording flow (if one doesn't already exist as its own page, build
  a minimal "Record Payment" modal against a bill) to link into a `MaintenanceBill` — no schema
  change needed, `Payment` already has `BillId`/`SocietyId`/audit from earlier work.
- [ ] `npm run build && npm run lint`; Playwright verification: Resident views their bill history,
  Treasurer records a payment against a bill, `OutstandingAmount` reflects it.
- [ ] Multi-bill payment allocation (`PaymentAllocation`) and late-fee automation
  (`PenaltyAmount`) are explicitly **out of scope** here — flagged as phase-2/future work in
  `mm §11.4`, not built in this pass.

---

## Cross-phase reminders

- Every new tenant-scoped entity implements `ITenantScoped`; every service constructor takes
  `ICurrentUserContext currentUser` and filters by `currentUser.SocietyId` — copy this from
  `FlatService.cs`, don't re-derive it.
- `MaintenanceBillLineItem` and `AuditLog` are the only two entities in this whole module that are
  **plain classes** (no `ITenantScoped`/`IAuditable`) — stamp their `SocietyId`/`CreatedOn` manually.
  Getting this backwards is the one mistake most likely to silently compile-fail or silently skip
  audit stamping.
- Every write endpoint needs its `RoleNames` constant checked against `mm §8`'s table before
  shipping — `Admin`-only for configuration, `RoleNames.BillingRoles` for cycle actions,
  `RoleNames.CommitteeRoles` for read-sensitive resources (Exemptions, Flat Groups).
- Don't start a phase's frontend work until that phase's backend is built, migrated, and verified
  against the real dev DB — same rule this project has followed since Residents.
