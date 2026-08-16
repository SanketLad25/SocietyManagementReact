-- ============================================================================
-- 004_maintenance_masters.sql — Maintenance module, Phase 1: master/reference tables.
-- See MaintenanceImplementation.md Phase 1 and maintenance.md §2.1/§2.2 for design rationale.
--
-- CalculationMethod and ChargeTargetType are global (mm §2.1) — same status as Role — and must be
-- created in this phase (not Phase 2) because SocietyChargeTargetType, also seeded here, FKs to
-- ChargeTargetType. Every other table below is per-society (SocietyId NOT NULL).
--
-- Run with: sqlcmd -S <server> -E -C -i database\004_maintenance_masters.sql
-- ============================================================================

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
-- Amenity (mm §2.2). AmenitySubscription table is created in Phase 2.
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
