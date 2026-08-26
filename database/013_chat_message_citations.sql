-- Chatbot module (SocChatBot.md) Phase 4: ChatOrchestrationService persists which sources (Notice/
-- KnowledgeArticle chunks, resolved to a title) were cited alongside an assistant's answer, so a
-- retrieved-content citation shown in the widget is reproducible from the stored exchange, not only
-- available at generation time. Append-only onto the existing ChatMessage table (012_chatbot.sql) —
-- that file is not edited in place, per this repo's migration convention.
--
-- NULL for every "user" row and for any "assistant" row whose answer wasn't grounded in retrieved
-- content (a pure tool-use or generic answer) — SocChatBot.md's widget only shows citations "under
-- RAG-sourced answers", so an empty/NULL value here is the normal case, not a gap.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

ALTER TABLE ChatMessage ADD Citations NVARCHAR(MAX) NULL;
GO
