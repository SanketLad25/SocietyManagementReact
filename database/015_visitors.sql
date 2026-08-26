-- Visitor Management module (VisitorManagement.md). Entirely net-new tables — the legacy
-- Visitor/SecurityGuard/VisitorEntry tables from schema.sql (lines ~104-133) are abandoned in
-- place (no SocietyId on Visitor, SecurityGuard disconnected from UserLogin/Role, VisitorEntry
-- duplicates Visitor.EntryTime/Status with no exit tracking) — never mapped to a C# entity, left
-- untouched here.
--
-- VisitorCategory/VisitorLog are ITenantScoped/IAuditable, same shape as ComplaintCategory/
-- Complaint. VisitorLogMember/VisitorAttachment/VisitorNotification are plain (insert-only or
-- append-only) tables, the same documented exception as ComplaintUpdate/ComplaintAttachment/
-- ComplaintNotification in 010_complaints.sql.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE VisitorCategory (
    VisitorCategoryId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    RequiresVehicleNo BIT NOT NULL CONSTRAINT DF_VisitorCategory_RequiresVehicleNo DEFAULT (0),
    RequiresCompanyName BIT NOT NULL CONSTRAINT DF_VisitorCategory_RequiresCompanyName DEFAULT (0),
    RequiresApprovalDefault BIT NOT NULL CONSTRAINT DF_VisitorCategory_RequiresApprovalDefault DEFAULT (1),
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_VisitorCategory_IsActive DEFAULT (1),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_VisitorCategory_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_VisitorCategory_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_VisitorCategory_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_VisitorCategory_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_VisitorCategory_Society_Name UNIQUE (SocietyId, CategoryName)
);
GO

CREATE INDEX IX_VisitorCategory_SocietyId ON VisitorCategory(SocietyId);
GO

CREATE TABLE VisitorLog (
    VisitorLogId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    FlatId INT NOT NULL,
    VisitorCategoryId INT NOT NULL,
    PrimaryVisitorName NVARCHAR(100) NOT NULL,
    PrimaryMobile VARCHAR(15) NULL,
    VehicleNo NVARCHAR(20) NULL,
    CompanyName NVARCHAR(100) NULL,
    PartySize INT NOT NULL CONSTRAINT DF_VisitorLog_PartySize DEFAULT (1),
    Purpose NVARCHAR(300) NULL,
    ApprovalRequired BIT NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_VisitorLog_Status DEFAULT ('PendingApproval'),
    EntryTime DATETIME NULL,
    ExitTime DATETIME NULL,
    LoggedByUserId INT NULL,
    CheckedOutByUserId INT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_VisitorLog_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_VisitorLog_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_VisitorLog_Flat FOREIGN KEY (FlatId) REFERENCES Flat(FlatId),
    CONSTRAINT FK_VisitorLog_Category FOREIGN KEY (VisitorCategoryId) REFERENCES VisitorCategory(VisitorCategoryId),
    CONSTRAINT FK_VisitorLog_LoggedBy FOREIGN KEY (LoggedByUserId) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_VisitorLog_CheckedOutBy FOREIGN KEY (CheckedOutByUserId) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_VisitorLog_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_VisitorLog_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_VisitorLog_FlatId ON VisitorLog(FlatId);
GO

CREATE INDEX IX_VisitorLog_Society_Status ON VisitorLog(SocietyId, Status);
GO

CREATE TABLE VisitorLogMember (
    VisitorLogMemberId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    VisitorLogId INT NOT NULL,
    MemberName NVARCHAR(100) NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_VisitorLogMember_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_VisitorLogMember_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_VisitorLogMember_VisitorLog FOREIGN KEY (VisitorLogId) REFERENCES VisitorLog(VisitorLogId)
);
GO

CREATE INDEX IX_VisitorLogMember_VisitorLogId ON VisitorLogMember(VisitorLogId);
GO

CREATE TABLE VisitorAttachment (
    VisitorAttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    VisitorLogId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    FileSizeBytes BIGINT NOT NULL,
    StoragePath NVARCHAR(400) NOT NULL,
    UploadedOn DATETIME NOT NULL CONSTRAINT DF_VisitorAttachment_UploadedOn DEFAULT (GETDATE()),
    UploadedBy INT NULL,
    CONSTRAINT FK_VisitorAttachment_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_VisitorAttachment_VisitorLog FOREIGN KEY (VisitorLogId) REFERENCES VisitorLog(VisitorLogId),
    CONSTRAINT FK_VisitorAttachment_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_VisitorAttachment_VisitorLogId ON VisitorAttachment(VisitorLogId);
GO

CREATE TABLE VisitorNotification (
    VisitorNotificationId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    VisitorLogId INT NOT NULL,
    RecipientUserId INT NOT NULL,
    Message NVARCHAR(200) NOT NULL,
    IsRead BIT NOT NULL CONSTRAINT DF_VisitorNotification_IsRead DEFAULT (0),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_VisitorNotification_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_VisitorNotification_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_VisitorNotification_VisitorLog FOREIGN KEY (VisitorLogId) REFERENCES VisitorLog(VisitorLogId),
    CONSTRAINT FK_VisitorNotification_Recipient FOREIGN KEY (RecipientUserId) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_VisitorNotification_RecipientUserId ON VisitorNotification(RecipientUserId);
GO
