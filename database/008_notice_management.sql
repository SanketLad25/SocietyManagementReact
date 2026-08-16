-- Notice Management module, Phase 0 (see notice.md).
-- NoticeCategory is new and per-society (same shape as MaintenanceCategory). Notice already exists
-- (schema.sql + 003_multi_tenant_audit.sql) and is ALTERed here, not recreated. NoticeAttachment and
-- NoticeReadStatus are new, plain (non-ITenantScoped/IAuditable) tables — see notice.md §2.2/§2.3 for
-- why (immutable snapshot rows, same documented exception as MaintenanceBillLineItem).
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE NoticeCategory (
    NoticeCategoryId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_NoticeCategory_IsActive DEFAULT (1),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_NoticeCategory_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_NoticeCategory_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_NoticeCategory_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_NoticeCategory_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_NoticeCategory_Society_Name UNIQUE (SocietyId, CategoryName)
);
GO

CREATE INDEX IX_NoticeCategory_SocietyId ON NoticeCategory(SocietyId);
GO

-- Notice already exists (NoticeId, SocietyId, Title, Description, PublishDate, ExpiryDate, CreatedBy,
-- CreatedOn, ModifiedOn, ModifiedBy) — table currently has 0 rows, so no backfill is needed before
-- tightening NOT NULL constraints.
ALTER TABLE Notice ADD CategoryId INT NULL;
GO
ALTER TABLE Notice ADD CONSTRAINT FK_Notice_NoticeCategory FOREIGN KEY (CategoryId) REFERENCES NoticeCategory(NoticeCategoryId);
GO
ALTER TABLE Notice ALTER COLUMN CategoryId INT NOT NULL;
GO

ALTER TABLE Notice ADD Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Notice_Priority DEFAULT ('Normal');
GO
ALTER TABLE Notice ADD Status VARCHAR(20) NOT NULL CONSTRAINT DF_Notice_Status DEFAULT ('Draft');
GO
ALTER TABLE Notice ALTER COLUMN PublishDate DATETIME NOT NULL;
GO

CREATE INDEX IX_Notice_CategoryId ON Notice(CategoryId);
CREATE INDEX IX_Notice_Status ON Notice(SocietyId, Status);
GO

CREATE TABLE NoticeAttachment (
    NoticeAttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    NoticeId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    FileSizeBytes BIGINT NOT NULL,
    StoragePath NVARCHAR(400) NOT NULL,
    UploadedOn DATETIME NOT NULL,
    UploadedBy INT NULL,
    CONSTRAINT FK_NoticeAttachment_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_NoticeAttachment_Notice FOREIGN KEY (NoticeId) REFERENCES Notice(NoticeId),
    CONSTRAINT FK_NoticeAttachment_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_NoticeAttachment_NoticeId ON NoticeAttachment(NoticeId);
GO

CREATE TABLE NoticeReadStatus (
    NoticeReadStatusId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    NoticeId INT NOT NULL,
    UserId INT NOT NULL,
    ReadOn DATETIME NOT NULL,
    CONSTRAINT FK_NoticeReadStatus_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_NoticeReadStatus_Notice FOREIGN KEY (NoticeId) REFERENCES Notice(NoticeId),
    CONSTRAINT FK_NoticeReadStatus_UserLogin FOREIGN KEY (UserId) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_NoticeReadStatus_Notice_User UNIQUE (NoticeId, UserId)
);
GO

CREATE INDEX IX_NoticeReadStatus_NoticeId ON NoticeReadStatus(NoticeId);
GO
