-- Multi-tenant conversion: every table gets SocietyId (tenant isolation) plus a standard
-- audit trail (CreatedOn/CreatedBy/ModifiedOn/ModifiedBy). Existing data is backfilled to a
-- single "Shubhangi CHSL" society (the app's original, single-tenant data).
--
-- Exceptions:
--   - Role: stays a single global list shared by every society (no SocietyId).
--   - Society: is the tenant root, doesn't reference itself (no SocietyId), but still gets audit columns.
--   - UserLogin: SocietyId stays NULLable (a NULL SocietyId marks a platform-level SuperAdmin account).
--   - AuditLog: insert-only log, so it gets SocietyId + CreatedOn only (no ModifiedOn/ModifiedBy,
--     and keeps its existing UserId column instead of a redundant new CreatedBy).
--   - Notice: already had a bare CreatedBy INT column in the original schema; reused here (FK added)
--     instead of creating a duplicate column.
--
-- Run with: sqlcmd -S <server> -E -i database\003_multi_tenant_audit.sql

USE [Society Management];
GO

-- Required for the filtered unique indexes below (SQL Server rejects CREATE INDEX under any
-- session that doesn't have this ON, and sqlcmd doesn't set it by default).
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 0. Seed the first tenant from the app's existing single-tenant data.
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM Society WHERE SocietyName = N'Shubhangi CHSL')
BEGIN
    INSERT INTO Society (SocietyName, Address, City, State, PinCode)
    VALUES (N'Shubhangi CHSL', N'Parabat Nagar, Dahisar East', N'Mumbai', N'Maharashtra', NULL);
END
GO

-- ============================================================================
-- 1. Role — global/shared across all societies. Audit columns only, no SocietyId.
-- ============================================================================
ALTER TABLE Role ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Role_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Role ADD CONSTRAINT FK_Role_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Role ADD CONSTRAINT FK_Role_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 2. Society — tenant root. Rename CreatedDate -> CreatedOn, add the rest.
-- ============================================================================
EXEC sp_rename 'Society.CreatedDate', 'CreatedOn', 'COLUMN';
GO
ALTER TABLE Society ADD
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Society ADD CONSTRAINT FK_Society_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Society ADD CONSTRAINT FK_Society_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Society ADD CONSTRAINT UQ_Society_SocietyName UNIQUE (SocietyName);
GO

-- ============================================================================
-- 3. UserLogin — SocietyId stays NULLable (NULL = platform SuperAdmin account).
--    Username uniqueness moves from implicit/global to per-society (or per-SuperAdmin-pool).
-- ============================================================================
ALTER TABLE UserLogin ADD SocietyId INT NULL;
GO
UPDATE UserLogin SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE UserLogin ADD CONSTRAINT FK_UserLogin_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_UserLogin_SocietyId ON UserLogin(SocietyId);
GO
CREATE UNIQUE INDEX UX_UserLogin_Society_Username ON UserLogin(SocietyId, Username) WHERE SocietyId IS NOT NULL;
GO
CREATE UNIQUE INDEX UX_UserLogin_SuperAdmin_Username ON UserLogin(Username) WHERE SocietyId IS NULL;
GO
ALTER TABLE UserLogin ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_UserLogin_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE UserLogin ADD CONSTRAINT FK_UserLogin_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE UserLogin ADD CONSTRAINT FK_UserLogin_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 4. Wing — SocietyId column already exists (nullable, FK already in place). Backfill + tighten.
-- ============================================================================
UPDATE Wing SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Wing ALTER COLUMN SocietyId INT NOT NULL;
GO
CREATE INDEX IX_Wing_SocietyId ON Wing(SocietyId);
GO
ALTER TABLE Wing ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Wing_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Wing ADD CONSTRAINT FK_Wing_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Wing ADD CONSTRAINT FK_Wing_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 5. Flat
-- ============================================================================
ALTER TABLE Flat ADD SocietyId INT NULL;
GO
UPDATE Flat SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Flat ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Flat ADD CONSTRAINT FK_Flat_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Flat_SocietyId ON Flat(SocietyId);
GO
ALTER TABLE Flat ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Flat_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Flat ADD CONSTRAINT FK_Flat_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Flat ADD CONSTRAINT FK_Flat_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 6. Resident
-- ============================================================================
ALTER TABLE Resident ADD SocietyId INT NULL;
GO
UPDATE Resident SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Resident ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Resident ADD CONSTRAINT FK_Resident_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Resident_SocietyId ON Resident(SocietyId);
GO
ALTER TABLE Resident ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Resident_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Resident ADD CONSTRAINT FK_Resident_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Resident ADD CONSTRAINT FK_Resident_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 7. MaintenanceBill — rename CreatedDate -> CreatedOn
-- ============================================================================
ALTER TABLE MaintenanceBill ADD SocietyId INT NULL;
GO
UPDATE MaintenanceBill SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE MaintenanceBill ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE MaintenanceBill ADD CONSTRAINT FK_MaintenanceBill_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_MaintenanceBill_SocietyId ON MaintenanceBill(SocietyId);
GO
EXEC sp_rename 'MaintenanceBill.CreatedDate', 'CreatedOn', 'COLUMN';
GO
ALTER TABLE MaintenanceBill ADD
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE MaintenanceBill ADD CONSTRAINT FK_MaintenanceBill_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE MaintenanceBill ADD CONSTRAINT FK_MaintenanceBill_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 8. Payment — PaymentDate is a business field, left as-is; audit columns are all new.
-- ============================================================================
ALTER TABLE Payment ADD SocietyId INT NULL;
GO
UPDATE Payment SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Payment ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT FK_Payment_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Payment_SocietyId ON Payment(SocietyId);
GO
ALTER TABLE Payment ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Payment_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT FK_Payment_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Payment ADD CONSTRAINT FK_Payment_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 9. Complaint — rename CreatedDate -> CreatedOn; ClosedDate is a business field, left as-is.
-- ============================================================================
ALTER TABLE Complaint ADD SocietyId INT NULL;
GO
UPDATE Complaint SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Complaint ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT FK_Complaint_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Complaint_SocietyId ON Complaint(SocietyId);
GO
EXEC sp_rename 'Complaint.CreatedDate', 'CreatedOn', 'COLUMN';
GO
ALTER TABLE Complaint ADD
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT FK_Complaint_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Complaint ADD CONSTRAINT FK_Complaint_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 10. Notice — already has a bare CreatedBy INT column; reuse it (add FK) instead of duplicating.
--     PublishDate/ExpiryDate are business fields, left as-is.
-- ============================================================================
ALTER TABLE Notice ADD SocietyId INT NULL;
GO
UPDATE Notice SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Notice ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Notice ADD CONSTRAINT FK_Notice_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Notice_SocietyId ON Notice(SocietyId);
GO
ALTER TABLE Notice ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Notice_CreatedOn DEFAULT GETDATE(),
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Notice ADD CONSTRAINT FK_Notice_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Notice ADD CONSTRAINT FK_Notice_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 11. Visitor — EntryTime/ExitTime are business fields, left as-is.
-- ============================================================================
ALTER TABLE Visitor ADD SocietyId INT NULL;
GO
UPDATE Visitor SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Visitor ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Visitor ADD CONSTRAINT FK_Visitor_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Visitor_SocietyId ON Visitor(SocietyId);
GO
ALTER TABLE Visitor ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Visitor_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Visitor ADD CONSTRAINT FK_Visitor_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Visitor ADD CONSTRAINT FK_Visitor_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 12. SecurityGuard
-- ============================================================================
ALTER TABLE SecurityGuard ADD SocietyId INT NULL;
GO
UPDATE SecurityGuard SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE SecurityGuard ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE SecurityGuard ADD CONSTRAINT FK_SecurityGuard_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_SecurityGuard_SocietyId ON SecurityGuard(SocietyId);
GO
ALTER TABLE SecurityGuard ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_SecurityGuard_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE SecurityGuard ADD CONSTRAINT FK_SecurityGuard_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE SecurityGuard ADD CONSTRAINT FK_SecurityGuard_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 13. VisitorEntry — EntryDate is a business field, left as-is.
-- ============================================================================
ALTER TABLE VisitorEntry ADD SocietyId INT NULL;
GO
UPDATE VisitorEntry SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE VisitorEntry ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE VisitorEntry ADD CONSTRAINT FK_VisitorEntry_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_VisitorEntry_SocietyId ON VisitorEntry(SocietyId);
GO
ALTER TABLE VisitorEntry ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_VisitorEntry_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE VisitorEntry ADD CONSTRAINT FK_VisitorEntry_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE VisitorEntry ADD CONSTRAINT FK_VisitorEntry_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 14. Parking
-- ============================================================================
ALTER TABLE Parking ADD SocietyId INT NULL;
GO
UPDATE Parking SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Parking ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Parking ADD CONSTRAINT FK_Parking_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Parking_SocietyId ON Parking(SocietyId);
GO
ALTER TABLE Parking ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Parking_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Parking ADD CONSTRAINT FK_Parking_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Parking ADD CONSTRAINT FK_Parking_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 15. Staff
-- ============================================================================
ALTER TABLE Staff ADD SocietyId INT NULL;
GO
UPDATE Staff SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Staff ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Staff ADD CONSTRAINT FK_Staff_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Staff_SocietyId ON Staff(SocietyId);
GO
ALTER TABLE Staff ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Staff_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Staff ADD CONSTRAINT FK_Staff_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Staff ADD CONSTRAINT FK_Staff_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 16. Event — EventDate is a business field, left as-is.
-- ============================================================================
ALTER TABLE Event ADD SocietyId INT NULL;
GO
UPDATE Event SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Event ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Event ADD CONSTRAINT FK_Event_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Event_SocietyId ON Event(SocietyId);
GO
ALTER TABLE Event ADD
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_Event_CreatedOn DEFAULT GETDATE(),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Event ADD CONSTRAINT FK_Event_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Event ADD CONSTRAINT FK_Event_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 17. Document — rename UploadedDate -> CreatedOn. ResidentId/FlatId stay nullable business links.
-- ============================================================================
ALTER TABLE Document ADD SocietyId INT NULL;
GO
UPDATE Document SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Document ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Document ADD CONSTRAINT FK_Document_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Document_SocietyId ON Document(SocietyId);
GO
EXEC sp_rename 'Document.UploadedDate', 'CreatedOn', 'COLUMN';
GO
ALTER TABLE Document ADD
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Document ADD CONSTRAINT FK_Document_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Document ADD CONSTRAINT FK_Document_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 18. Invoice — rename CreatedDate -> CreatedOn. InvoiceDate/DueDate are business fields, left as-is.
-- ============================================================================
ALTER TABLE Invoice ADD SocietyId INT NULL;
GO
UPDATE Invoice SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE Invoice ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE Invoice ADD CONSTRAINT FK_Invoice_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_Invoice_SocietyId ON Invoice(SocietyId);
GO
EXEC sp_rename 'Invoice.CreatedDate', 'CreatedOn', 'COLUMN';
GO
ALTER TABLE Invoice ADD
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL;
GO
ALTER TABLE Invoice ADD CONSTRAINT FK_Invoice_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Invoice ADD CONSTRAINT FK_Invoice_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId);
GO

-- ============================================================================
-- 19. AuditLog — insert-only log. SocietyId + renamed CreatedOn only; no ModifiedOn/ModifiedBy,
--     and no new CreatedBy (it already has UserId serving that role).
-- ============================================================================
ALTER TABLE AuditLog ADD SocietyId INT NULL;
GO
UPDATE AuditLog SET SocietyId = (SELECT SocietyId FROM Society WHERE SocietyName = N'Shubhangi CHSL')
WHERE SocietyId IS NULL;
GO
ALTER TABLE AuditLog ALTER COLUMN SocietyId INT NOT NULL;
GO
ALTER TABLE AuditLog ADD CONSTRAINT FK_AuditLog_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId);
GO
CREATE INDEX IX_AuditLog_SocietyId ON AuditLog(SocietyId);
GO
EXEC sp_rename 'AuditLog.CreatedDate', 'CreatedOn', 'COLUMN';
GO
