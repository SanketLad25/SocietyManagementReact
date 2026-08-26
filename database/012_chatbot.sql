-- Chatbot module (SocChatBot.md). Phase 1 created schema for all five tables, full C#/EF module
-- (entity + service + controller) for KnowledgeArticle only — ChatSession/ChatMessage/DocumentChunk/
-- ChunkEmbedding were created then (same precedent as 010_complaints.sql/011_events.sql creating a
-- whole module's tables up front) but stayed EF-unmapped pending later phases. Phase 2 adds EF
-- mapping + reads/writes for DocumentChunk/ChunkEmbedding (ingestion + VECTOR_DISTANCE retrieval);
-- ChatSession/ChatMessage remain EF-unmapped until Phase 4.
--
-- Audit-column shape (SocChatBot.md "Audit-column shape, resolved explicitly"): ChatSession,
-- ChatMessage, DocumentChunk, ChunkEmbedding are plain tables — no ITenantScoped/IAuditable, same
-- documented exception as NoticeAttachment (008_notice_management.sql) and ComplaintUpdate/
-- ComplaintNotification (010_complaints.sql): insert-only/immutable rows, SocietyId set by hand at
-- creation time by whichever service creates them. KnowledgeArticle is the one genuinely mutable
-- table here (an Admin edits an FAQ/policy over time) and gets the full SocietyId +
-- CreatedOn/CreatedBy/ModifiedOn/ModifiedBy audit-column set, matching NoticeCategory/Notice.
--
-- DocumentChunk.SourceId is deliberately NOT a foreign key — it's a polymorphic pointer (paired
-- with SourceType) at either Notice or KnowledgeArticle, two different tables, so a single FK
-- constraint can't express it. Every other FK-able column in this file does get a real constraint.
--
-- ChunkEmbedding.Embedding uses the native VECTOR type, confirmed working against this app's actual
-- localhost\SQL2025 instance (SocChatBot.md "Environment facts"). Dimension 1024 matches the chosen
-- embeddings provider, Voyage AI's voyage-2 model (SocChatBot.md "New schema").
--
-- ChunkEmbedding.EmbeddingProvider/EmbeddingModel (Phase 2 correction, same "fix an empty table in
-- place" precedent as the ChatSession.UserId fix above): Phase 1 originally created a single
-- EmbeddingModel column. SocChatBot.md's schema section calls for separate EmbeddingProvider and
-- EmbeddingModel columns so a re-embed job can select "every row not produced by the currently
-- configured provider+model" with a plain WHERE clause, without parsing a combined identifier
-- (e.g. "Voyage:voyage-2"). Table was empty (Phase 2 hadn't started writing to it yet), so this file
-- and the live table were both corrected directly rather than appending a 013_ migration for a
-- one-column split of a table nothing has written to yet.
--
-- ChatSession.UserId (not ResidentId) is the session-ownership key: AdminUserService only backfills
-- UserLogin.ResidentId for RoleNames.Resident accounts, so every other chat-eligible role (Admin,
-- Chairman, Secretary, Treasurer, Security) has ResidentId = NULL and would be indistinguishable from
-- each other on ResidentId alone. UserId is always non-null for any authenticated non-SuperAdmin
-- caller (matches ICurrentUserContext.UserId) and is what Phase 4's "my sessions" lookup scopes on.
-- ResidentId is retained purely for tool-resolution/flat-lookup convenience, not as an ownership key.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE ChatSession (
    ChatSessionId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    UserId INT NOT NULL,
    ResidentId INT NULL,
    StartedAt DATETIME NOT NULL CONSTRAINT DF_ChatSession_StartedAt DEFAULT (GETDATE()),
    CONSTRAINT FK_ChatSession_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ChatSession_UserLogin FOREIGN KEY (UserId) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_ChatSession_Resident FOREIGN KEY (ResidentId) REFERENCES Resident(ResidentId)
);
GO

CREATE INDEX IX_ChatSession_SocietyId ON ChatSession(SocietyId);
GO

CREATE INDEX IX_ChatSession_UserId ON ChatSession(UserId);
GO

CREATE TABLE ChatMessage (
    ChatMessageId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    ChatSessionId INT NOT NULL,
    Role NVARCHAR(20) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ChatMessage_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_ChatMessage_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_ChatMessage_ChatSession FOREIGN KEY (ChatSessionId) REFERENCES ChatSession(ChatSessionId)
);
GO

CREATE INDEX IX_ChatMessage_ChatSessionId ON ChatMessage(ChatSessionId);
GO

CREATE TABLE KnowledgeArticle (
    KnowledgeArticleId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Body NVARCHAR(MAX) NOT NULL,
    Category NVARCHAR(100) NULL,
    IsPublished BIT NOT NULL CONSTRAINT DF_KnowledgeArticle_IsPublished DEFAULT (1),
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_KnowledgeArticle_CreatedOn DEFAULT (GETDATE()),
    CreatedBy INT NULL,
    ModifiedOn DATETIME NULL,
    ModifiedBy INT NULL,
    CONSTRAINT FK_KnowledgeArticle_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId),
    CONSTRAINT FK_KnowledgeArticle_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES UserLogin(UserId),
    CONSTRAINT FK_KnowledgeArticle_ModifiedBy FOREIGN KEY (ModifiedBy) REFERENCES UserLogin(UserId)
);
GO

CREATE INDEX IX_KnowledgeArticle_SocietyId ON KnowledgeArticle(SocietyId);
GO

CREATE TABLE DocumentChunk (
    DocumentChunkId INT IDENTITY(1,1) PRIMARY KEY,
    SocietyId INT NOT NULL,
    SourceType NVARCHAR(20) NOT NULL,
    SourceId INT NOT NULL,
    ChunkText NVARCHAR(MAX) NOT NULL,
    ChunkIndex INT NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_DocumentChunk_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_DocumentChunk_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId)
    -- SourceId intentionally has no FK: SourceType/SourceId together point polymorphically at
    -- either Notice or KnowledgeArticle (see SocChatBot.md "New schema"), which a single FK
    -- constraint can't express.
);
GO

CREATE INDEX IX_DocumentChunk_SocietyId ON DocumentChunk(SocietyId);
GO

CREATE INDEX IX_DocumentChunk_Source ON DocumentChunk(SourceType, SourceId);
GO

CREATE TABLE ChunkEmbedding (
    ChunkEmbeddingId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentChunkId INT NOT NULL,
    SocietyId INT NOT NULL,
    Embedding VECTOR(1024) NOT NULL,
    EmbeddingProvider NVARCHAR(50) NOT NULL,
    EmbeddingModel NVARCHAR(100) NOT NULL,
    CreatedOn DATETIME NOT NULL CONSTRAINT DF_ChunkEmbedding_CreatedOn DEFAULT (GETDATE()),
    CONSTRAINT FK_ChunkEmbedding_DocumentChunk FOREIGN KEY (DocumentChunkId) REFERENCES DocumentChunk(DocumentChunkId),
    CONSTRAINT FK_ChunkEmbedding_Society FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId)
);
GO

CREATE INDEX IX_ChunkEmbedding_DocumentChunkId ON ChunkEmbedding(DocumentChunkId);
GO

CREATE INDEX IX_ChunkEmbedding_SocietyId ON ChunkEmbedding(SocietyId);
GO
