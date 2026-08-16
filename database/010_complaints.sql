-- Complaints module, Phase 0 (see complaints.md). ComplaintCategory is new and per-society (same
-- shape as NoticeCategory/MaintenanceCategory). ComplaintUpdate/ComplaintAttachment/
-- ComplaintNotification are all new, plain (non-ITenantScoped/IAuditable) tables — same documented
-- exception as NoticeAttachment (immutable snapshot rows, complaints.md §2.3/§2.4/§2.5).
--
-- Complaint ALREADY EXISTS from the original schema.sql (ComplaintId, ResidentId, Subject,
-- Description NVARCHAR(MAX), Status VARCHAR(30), Priority VARCHAR(20), CreatedOn, ClosedDate,
-- SocietyId, CreatedBy, ModifiedOn, ModifiedBy — 0 rows) — same "table exists, nothing built on it
-- yet" situation Notice/Parking were in. This migration ALTERs it (renames ClosedDate to ClosedOn
-- for IAuditable-style naming consistency, tightens Status/Priority/CreatedOn to NOT NULL with
-- defaults, adds the new columns) rather than recreating it. `Subject` is left as-is, nullable and
-- unused by this module — not part of the request's design, but not worth dropping either.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE ComplaintCategory (
    ComplaintCategoryId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_ComplaintCategory_IsActive DEFAULT (1),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ComplaintCategory_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_ComplaintCategory_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ComplaintCategory_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_ComplaintCategory_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_ComplaintCategory_Society_Name UNIQUE (SocietyId, CategoryName)
);
GO

CREATE INDEX IX_ComplaintCategory_SocietyId ON ComplaintCategory(SocietyId);
GO

-- Table has 0 rows — safe to tighten NOT NULL / rename in place without a backfill pass.
-- Pre-existing objects (IX_Complaint_ResidentId, and — once added below — the Status/Priority
-- defaults) must be dropped before ALTER COLUMN and re-created after; SQL Server won't let you
-- change a column's type/nullability while an index or default constraint is bound to it.
EXEC sp_rename 'Complaint.ClosedDate', 'ClosedOn', 'COLUMN';
GO

DROP INDEX IX_Complaint_ResidentId ON Complaint;
GO
ALTER TABLE Complaint ALTER COLUMN ResidentId INT NOT NULL;
GO
ALTER TABLE Complaint ALTER COLUMN Description NVARCHAR(1000) NOT NULL;
GO

ALTER TABLE Complaint ALTER COLUMN Status NVARCHAR(20) NOT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT DF_Complaint_Status DEFAULT ('Open') FOR Status;
GO

ALTER TABLE Complaint ALTER COLUMN Priority NVARCHAR(10) NOT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT DF_Complaint_Priority DEFAULT ('Medium') FOR Priority;
GO

ALTER TABLE Complaint ALTER COLUMN CreatedOn DATETIME NOT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT DF_Complaint_CreatedOn DEFAULT (GETDATE()) FOR CreatedOn;
GO

ALTER TABLE Complaint ADD FlatId INT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT FK_Complaint_Flat FOREIGN KEY (FlatId) REFERENCES Flat(FlatId);
GO

ALTER TABLE Complaint ADD CategoryId INT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT FK_Complaint_Category FOREIGN KEY (CategoryId) REFERENCES ComplaintCategory(ComplaintCategoryId);
GO
ALTER TABLE Complaint ALTER COLUMN CategoryId INT NOT NULL;
GO

ALTER TABLE Complaint ADD AssignedToName NVARCHAR(100) NULL;
GO
ALTER TABLE Complaint ADD AssignedToContact NVARCHAR(20) NULL;
GO
ALTER TABLE Complaint ADD AssignmentNotes NVARCHAR(300) NULL;
GO
ALTER TABLE Complaint ADD AssignedBy INT NULL;
GO
ALTER TABLE Complaint ADD CONSTRAINT FK_Complaint_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES UserLogin(UserId);
GO
ALTER TABLE Complaint ADD AssignedOn DATETIME NULL;
GO
ALTER TABLE Complaint ADD ResidentConfirmed BIT NOT NULL CONSTRAINT DF_Complaint_ResidentConfirmed DEFAULT (0);
GO
ALTER TABLE Complaint ADD ResidentConfirmedOn DATETIME NULL;
GO

CREATE INDEX IX_Complaint_ResidentId ON Complaint(ResidentId);
GO

CREATE TABLE ComplaintUpdate (
    ComplaintUpdateId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    ComplaintId INT NOT NULL,
    UpdateType NVARCHAR(20) NOT NULL,
    OldStatus NVARCHAR(20) NULL,
    NewStatus NVARCHAR(20) NULL,
    CommentText NVARCHAR(500) NULL,
    CreatedBy INT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ComplaintUpdate_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_ComplaintUpdate_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ComplaintUpdate_Complaint FOREIGN KEY (ComplaintId) REFERENCES Complaint(ComplaintId),
    CONSTRAINT FK_ComplaintUpdate_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_ComplaintUpdate_ComplaintId ON ComplaintUpdate(ComplaintId);
GO

CREATE TABLE ComplaintAttachment (
    ComplaintAttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    ComplaintId INT NOT NULL,
    AttachmentKind NVARCHAR(20) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    FileSizeBytes BIGINT NOT NULL,
    StoragePath NVARCHAR(400) NOT NULL,
    UploadedOn DATETIME NOT NULL CONSTRAINT DF_ComplaintAttachment_UploadedOn DEFAULT (GETDATE()),
    UploadedBy INT NULL,
    CONSTRAINT FK_ComplaintAttachment_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ComplaintAttachment_Complaint FOREIGN KEY (ComplaintId) REFERENCES Complaint(ComplaintId),
    CONSTRAINT FK_ComplaintAttachment_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_ComplaintAttachment_ComplaintId ON ComplaintAttachment(ComplaintId);
GO

CREATE TABLE ComplaintNotification (
    ComplaintNotificationId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    ComplaintId INT NOT NULL,
    RecipientUserId INT NOT NULL,
    Message NVARCHAR(200) NOT NULL,
    IsRead BIT NOT NULL CONSTRAINT DF_ComplaintNotification_IsRead DEFAULT (0),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ComplaintNotification_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_ComplaintNotification_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ComplaintNotification_Complaint FOREIGN KEY (ComplaintId) REFERENCES Complaint(ComplaintId),
    CONSTRAINT FK_ComplaintNotification_Recipient FOREIGN KEY (RecipientUserId) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_ComplaintNotification_RecipientUserId ON ComplaintNotification(RecipientUserId);
GO
