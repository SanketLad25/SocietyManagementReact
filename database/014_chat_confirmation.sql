-- Chatbot module (SocChatBot.md) Phase 5: confirmation-gating for mutating tools (raise_complaint,
-- join_event). Append-only onto the existing chat schema (012_chatbot.sql/013_chat_message_citations.sql)
-- — neither file is edited in place, per this repo's migration convention.
--
-- ChatPendingAction: one row per paused tool_use awaiting the resident's explicit Confirm/Cancel
-- (SocChatBot.md "Phase 5 design decisions" — resolved 2026-08-26). Plain table, no
-- ITenantScoped/IAuditable, same documented exception as ChatSession/ChatMessage in 012_chatbot.sql
-- (SocietyId set by hand by ChatOrchestrationService at creation time) — even though this table's
-- Status column IS updated in place once (Pending -> Confirmed/Cancelled/Expired), it still has no
-- CreatedBy/ModifiedBy/ModifiedOn columns, so it can't implement the full IAuditable/ITenantScoped
-- shape the same way ChatSession/ChatMessage can't.
--
-- IdempotencyKey here does double duty (SocChatBot.md's resolved design, not a shortcut): the same
-- server-generated GUID is both (a) the opaque "token" ChatConfirmActionRequest.Token identifies the
-- pending row by, and (b) the value later stamped on Complaint.IdempotencyKey if the confirmed tool
-- is raise_complaint (harmless/unused for join_event, which is already upsert-safe via
-- UX_EventRegistration_Event_Resident from 011_events.sql). Declared NOT NULL + UNIQUE here (unlike
-- Complaint.IdempotencyKey below) because every ChatPendingAction row is always stamped with one at
-- creation — there's no "row with no key yet" case to leave NULL for, so no filtered index is needed
-- on this table.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE ChatPendingAction (
    ChatPendingActionId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    ChatSessionId INT NOT NULL,
    ToolName NVARCHAR(50) NOT NULL,
    ToolInputJson NVARCHAR(MAX) NOT NULL,
    ToolUseId NVARCHAR(100) NOT NULL,
    ConversationSnapshotJson NVARCHAR(MAX) NOT NULL,
    IdempotencyKey UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_ChatPendingAction_Status DEFAULT ('Pending'),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ChatPendingAction_CreatedOn DEFAULT (GETDATE()),
    ExpiresOn DATETIME NOT NULL,
    CONSTRAINT FK_ChatPendingAction_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ChatPendingAction_ChatSession FOREIGN KEY (ChatSessionId) REFERENCES ChatSession(ChatSessionId)
);
GO

CREATE INDEX IX_ChatPendingAction_SocietyId ON ChatPendingAction(SocietyId);
GO

CREATE INDEX IX_ChatPendingAction_ChatSessionId ON ChatPendingAction(ChatSessionId);
GO

CREATE UNIQUE INDEX UX_ChatPendingAction_IdempotencyKey ON ChatPendingAction(IdempotencyKey);
GO

-- Complaint.IdempotencyKey: nullable because every REST-created complaint (AdminUsersController-free
-- path, the ordinary POST /api/complaints flow) has none — only a chatbot-confirmed raise_complaint
-- call stamps one. SQL Server allows only one NULL in a plain UNIQUE index/constraint, and there will
-- be many NULL rows (every pre-existing and every REST-created complaint), so the uniqueness
-- guarantee is expressed as a FILTERED index (sql-server skill: "ALTER/constraint pitfalls") rather
-- than a table-level UNIQUE constraint.
ALTER TABLE Complaint ADD IdempotencyKey UNIQUEIDENTIFIER NULL;
GO

CREATE UNIQUE INDEX UX_Complaint_IdempotencyKey ON Complaint(IdempotencyKey) WHERE IdempotencyKey IS NOT NULL;
GO
