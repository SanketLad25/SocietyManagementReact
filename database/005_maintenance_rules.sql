-- ============================================================================
-- 005_maintenance_rules.sql — Maintenance module, Phase 2: charge rules, exemptions,
-- amenity subscriptions. See MaintenanceImplementation.md Phase 2 and maintenance.md §2.2/§7.
--
-- MaintenanceChargeRule.TargetId is deliberately NOT FK-enforced — it's polymorphic across
-- Wing/FlatGroup/Flat/ParkingType/Amenity depending on ChargeTargetTypeId, validated in the
-- service layer (MaintenanceTargetResolver), not the database.
--
-- Run with: sqlcmd -S <server> -E -C -i database\005_maintenance_rules.sql
-- ============================================================================

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
