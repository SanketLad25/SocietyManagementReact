-- ============================================================================
-- 006_maintenance_billing.sql — Maintenance module, Phase 3: billing cycles, generation.
-- See MaintenanceImplementation.md Phase 3 and maintenance.md §2.3/§6.
--
-- MaintenanceBillLineItem has no CreatedBy/ModifiedOn/ModifiedBy — it's an immutable snapshot
-- row, same exception as AuditLog (mm §2.3/§2.5): once a bill is generated, its line items are
-- never edited, only superseded by a fresh generation run.
--
-- Run with: sqlcmd -S <server> -E -C -i database\006_maintenance_billing.sql
-- ============================================================================

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
