-- Events module, Phase 1 (see events.md). EventCategory is new and per-society (same shape as
-- ComplaintCategory/NoticeCategory). EventRegistration, EventAttachment, and EventNotification are
-- all created here too (matches how 010_complaints.sql created all five Complaints tables up front
-- even though the module was built across four phases) but stay EF-unmapped until their own phases.
--
-- Event ALREADY EXISTS from the original schema.sql (EventId, EventName, EventDate, Description —
-- 0 rows), and already picked up SocietyId/CreatedOn/CreatedBy/ModifiedOn/ModifiedBy back in
-- 003_multi_tenant_audit.sql (it was in that migration's table list). This migration ALTERs it
-- further in place rather than recreating it, and does NOT re-add the multi-tenant/audit columns.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE EventCategory (
    EventCategoryId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    DisplayOrder INT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_EventCategory_IsActive DEFAULT (1),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_EventCategory_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_EventCategory_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_EventCategory_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_EventCategory_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_EventCategory_Society_Name UNIQUE (SocietyId, CategoryName)
);
GO

CREATE INDEX IX_EventCategory_SocietyId ON EventCategory(SocietyId);
GO

-- Table has 0 rows — safe to tighten NOT NULL / rename in place without a backfill pass.
EXEC sp_rename 'Event.EventDate', 'StartOn', 'COLUMN';
GO

ALTER TABLE Event ALTER COLUMN EventName NVARCHAR(150) NOT NULL;
GO
ALTER TABLE Event ALTER COLUMN StartOn DATETIME NOT NULL;
GO
ALTER TABLE Event ALTER COLUMN Description NVARCHAR(1000) NOT NULL;
GO

ALTER TABLE Event ADD EventCategoryId INT NULL;
GO
ALTER TABLE Event ADD CONSTRAINT FK_Event_Category FOREIGN KEY (EventCategoryId) REFERENCES EventCategory(EventCategoryId);
GO
ALTER TABLE Event ALTER COLUMN EventCategoryId INT NOT NULL;
GO

ALTER TABLE Event ADD EndOn DATETIME NULL;
GO
ALTER TABLE Event ADD Venue NVARCHAR(150) NOT NULL CONSTRAINT DF_Event_Venue DEFAULT ('');
GO
ALTER TABLE Event ADD CoverEmoji NVARCHAR(10) NULL;
GO
ALTER TABLE Event ADD CoverImagePath NVARCHAR(400) NULL;
GO
ALTER TABLE Event ADD OrganizerName NVARCHAR(150) NOT NULL CONSTRAINT DF_Event_OrganizerName DEFAULT ('');
GO
ALTER TABLE Event ADD MaxParticipants INT NULL;
GO
ALTER TABLE Event ADD RegistrationRequired BIT NOT NULL CONSTRAINT DF_Event_RegistrationRequired DEFAULT (1);
GO
ALTER TABLE Event ADD Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Event_Status DEFAULT ('Published');
GO
ALTER TABLE Event ADD CancelReason NVARCHAR(500) NULL;
GO

CREATE TABLE EventRegistration (
    EventRegistrationId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    EventId INT NOT NULL,
    ResidentId INT NOT NULL,
    FlatId INT NOT NULL,
    ParticipantCount INT NOT NULL CONSTRAINT DF_EventRegistration_ParticipantCount DEFAULT (1),
    Comments NVARCHAR(500) NULL,
    Status NVARCHAR(20) NOT NULL,
    RegistrationCode VARCHAR(20) NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_EventRegistration_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_EventRegistration_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_EventRegistration_Event FOREIGN KEY (EventId) REFERENCES Event(EventId),
    CONSTRAINT FK_EventRegistration_Resident FOREIGN KEY (ResidentId) REFERENCES Resident(ResidentId),
    CONSTRAINT FK_EventRegistration_Flat FOREIGN KEY (FlatId) REFERENCES Flat(FlatId),
    CONSTRAINT FK_EventRegistration_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_EventRegistration_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT UX_EventRegistration_Event_Resident UNIQUE (EventId, ResidentId),
    CONSTRAINT UX_EventRegistration_Code UNIQUE (RegistrationCode)
);
GO

CREATE INDEX IX_EventRegistration_EventId ON EventRegistration(EventId);
GO

CREATE TABLE EventAttachment (
    EventAttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    EventId INT NOT NULL,
    AttachmentKind NVARCHAR(20) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    FileSizeBytes BIGINT NOT NULL,
    StoragePath NVARCHAR(400) NOT NULL,
    UploadedOn DATETIME NOT NULL CONSTRAINT DF_EventAttachment_UploadedOn DEFAULT (GETDATE()),
    UploadedBy INT NULL,
    CONSTRAINT FK_EventAttachment_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_EventAttachment_Event FOREIGN KEY (EventId) REFERENCES Event(EventId),
    CONSTRAINT FK_EventAttachment_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_EventAttachment_EventId ON EventAttachment(EventId);
GO

CREATE TABLE EventNotification (
    EventNotificationId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    EventId INT NOT NULL,
    RecipientUserId INT NOT NULL,
    Message NVARCHAR(200) NOT NULL,
    IsRead BIT NOT NULL CONSTRAINT DF_EventNotification_IsRead DEFAULT (0),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_EventNotification_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_EventNotification_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_EventNotification_Event FOREIGN KEY (EventId) REFERENCES Event(EventId),
    CONSTRAINT FK_EventNotification_Recipient FOREIGN KEY (RecipientUserId) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_EventNotification_RecipientUserId ON EventNotification(RecipientUserId);
GO
