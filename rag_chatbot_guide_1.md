# AI Chatbot with RAG for a Society Management System
### Architecture & Build Guide — .NET Core + React + SQL Server + Claude

## Is this feasible?

Yes — this is a well-supported, common architecture. .NET Core as the API layer, React as the chat UI, SQL Server as the data store, and Claude as the reasoning/generation engine all fit together cleanly. The only piece that needs a deliberate decision is *where the retrieval (RAG) index lives*, since Claude itself doesn't generate embeddings or host a vector store — that part has to be built alongside your existing SQL Server database. The rest of this guide covers exactly how to do that, and how to use Claude as your build partner at each step.

One important framing before you start: a society management chatbot will get two very different kinds of questions, and they need two different techniques, not just RAG.

- **"Knowledge" questions** — "What's the visitor policy?", "What documents do I need to sell my flat?", "What were last month's AGM minutes?" These are answered well by **RAG**: semantic search over your bylaws, circulars, notices, and FAQs, followed by Claude generating an answer grounded in the retrieved text.
- **"My account" / live-data questions** — "What's my maintenance due?", "Has my complaint #482 been resolved?", "Book the clubhouse for Saturday." These should **not** go through embeddings-based retrieval — embeddings can't guarantee an exact, current number or row. These are answered correctly by giving Claude **tool use (function calling)** to query SQL Server directly for that resident's data.

A good chatbot for this domain is a **hybrid of RAG + tool use**, not RAG alone. I've built the rest of this guide around that.

### Your current SQL Server: no upgrade needed for this

`SELECT @@VERSION` confirms you're on **SQL Server 2022 (16.0.1190.2), Developer Edition**. Two things follow from that:

- **You don't need to upgrade to SQL Server 2025 to build this.** SQL Server 2022 has everything the fallback RAG approach in this guide needs (a table to store embeddings, and C# to compute cosine similarity). Treat a 2025 upgrade as an independent infrastructure decision, not a dependency of the chatbot project.
- **Developer Edition is not licensed for production.** It's fully featured and free, but Microsoft's licensing restricts it to development/test environments. If this society management system serves real residents, plan to run production on Standard or Enterprise edition (or Azure SQL) before go-live — worth flagging to whoever owns infrastructure/licensing now rather than discovering it during launch prep.

## Architecture Overview

```
React (chat widget)
      │  HTTPS / SSE stream
      ▼
ASP.NET Core Web API
  ├─ AuthN/AuthZ (JWT, resident/admin roles)
  ├─ ChatController  → ChatOrchestrationService
  │        ├─ RetrievalService  ──► Vector index (see options below)
  │        ├─ ToolExecutionService ──► SQL Server (EF Core) — dues, complaints, bookings, notices
  │        └─ ClaudeClient (Messages API, streaming, tool_use loop)
  └─ IngestionService (offline/background job)
           reads bylaws/circulars/FAQs/notices → chunks → embeddings (Voyage AI or similar) → vector index
SQL Server
  ├─ existing tables: Residents, Flats, Dues, Complaints, Bookings, Notices, Documents...
  └─ new tables: ChatSessions, ChatMessages, DocumentChunks, ChunkEmbeddings (or external vector store)
```

### Choosing where embeddings live

Claude does not expose an embeddings endpoint, so you need a separate embedding model plus somewhere to store and search the resulting vectors. Pick based on your SQL Server version and expected data volume (a single society's documents are usually small — hundreds to a few thousand chunks — so don't over-engineer this):

| Option | When to use it |
|---|---|
| **SQL Server 2025 native `VECTOR` type + vector search** | You're on (or can upgrade to) SQL Server 2025 / Azure SQL with vector support. Keeps everything in one database — simplest ops story. Confirm current syntax/availability against Microsoft's docs when you start, since this feature is still maturing. |
| **In-app cosine similarity over a `VARBINARY`/JSON column** | **← this is you.** SQL Server 2019/2022, corpus is small (a few thousand chunks per tenant). Store each chunk's embedding as a float array, pull candidates into memory (filtered to the current tenant first — see Multi-Tenancy below), and rank with cosine similarity in C#. Fine even across dozens of societies, since you never rank across tenants at once. |
| **Azure AI Search** | You want a managed, production-grade vector + keyword hybrid search, and you're already in the Azure ecosystem. It can even index directly from Azure SQL. |
| **Dedicated vector DB (Qdrant, Pinecone, Weaviate, etc.)** | You expect to scale to multiple societies/tenants with a large combined document set, or want vector-specific tooling (filtering, hybrid search) beyond what SQL Server offers. |

For a single society's document set, start with **in-app cosine similarity in SQL Server** — it's the least new infrastructure, and you can swap in Azure AI Search or a dedicated vector DB later without changing the rest of the architecture, since retrieval sits behind one `IRetrievalService` interface.

### Embeddings model

Since Claude doesn't do embeddings, Anthropic's own recommendation is **Voyage AI** (Anthropic acquired Voyage AI), so that's a reasonable default; Azure OpenAI's `text-embedding-3-*` models are an equally valid alternative if you're already provisioned on Azure. Either is called once during ingestion (to embed each chunk) and once per user query (to embed the question) — both are cheap, high-throughput calls, not part of the expensive generation step.

## Multi-Tenancy: What Changes

You mentioned the society management system is multi-tenant (multiple societies sharing the platform). This is the single biggest thing to design correctly before writing any RAG or chat code — get it wrong and one society's bylaws, dues, or complaints can leak into another society's chat answers.

**First, confirm your isolation model**, since it changes the specifics below: most SaaS society-management platforms use a **shared database with a `SocietyId`/`TenantId` column on every table** (simplest to operate, what the rest of this section assumes); some instead use **one database per tenant** or **one schema per tenant**. If you're on the latter two, the principle is the same but the enforcement mechanism differs (you'd pick the connection/schema per request instead of filtering rows).

Assuming shared-database-with-`TenantId`, here's what it changes in the plan above:

- **Every new table needs a `TenantId` column** — `ChatSessions`, `ChatMessages`, `DocumentChunks`, and `ChunkEmbeddings` all get one, exactly like your existing `Residents`/`Flats`/`Dues` tables presumably already have.
- **Ingestion must tag every chunk with its owning tenant.** When you chunk and embed Society A's bylaws, the resulting rows carry `TenantId = A`. Never run a single "embed everything" batch that mixes documents from multiple societies without tagging each row.
- **Retrieval must filter by tenant *before* ranking, not after.** Your `RetrievalService.SearchAsync` should take a `tenantId` parameter and add `WHERE TenantId = @tenantId` as the very first predicate, so cosine similarity only ever runs over that one society's chunks. This is also a performance win — you're ranking hundreds of rows, not the whole platform's corpus.
- **Every SQL-backed tool takes both `TenantId` and `ResidentId`, resolved server-side.** `get_my_dues`, `get_complaint_status`, `create_complaint`, `book_amenity` — all of them should resolve *both* IDs from the authenticated JWT/session, never from the client payload or from arguments Claude's tool-use response supplies. A resident authenticated into Society A's tenant should be structurally incapable of querying Society B's data, regardless of what the model is asked or tricked into requesting.
- **Add SQL Server Row-Level Security (RLS) as a second layer, not just application code.** RLS has been available since SQL Server 2016, so it works on your 2022 instance today. Set the current `TenantId` into `SESSION_CONTEXT` at the start of each request, and add a security policy/predicate function on your tables that filters by it automatically. That way, even if a future developer forgets a `WHERE TenantId = ...` clause somewhere, the database itself still won't return cross-tenant rows. This is worth doing before this feature ships, not as a later hardening pass — see Step 4 below, which does this right after the schema exists rather than deferring it to the security pass near the end of the build.
- **Build the system prompt per-tenant.** Society name, specific policies, and tone should be assembled per request based on the resolved tenant — e.g. "You are the assistant for Sunrise Heights CHS's resident portal," pulled from that society's settings row, not hardcoded.
- **Track Claude/embeddings usage per tenant.** Since you're presumably metering or billing societies individually (or at least want visibility into cost drivers), log token counts against `TenantId` from day one — retrofitting usage attribution later is annoying.

## Step-by-Step Build Plan (and how to use Claude at each step)

Work through these in order. At each step, open a session with Claude (this assistant, or Claude Code if you're working in your own IDE/terminal) and paste in the relevant context — your existing schema, the previous step's generated code, error messages — rather than asking for the whole system in one prompt. Small, grounded steps produce far better code than one giant "build me a RAG chatbot" prompt.

### Step 1 — Scope the use cases before writing code

List the actual questions residents/admins will ask, and tag each as RAG, Tool-use, or Hybrid. Example for a society management system:

- "What's the guest parking policy?" → RAG (bylaws doc)
- "What's my outstanding maintenance amount?" → Tool-use (query `Dues` table, scoped to the logged-in resident)
- "Is the gym open on Sundays?" → RAG (facility rules doc)
- "Raise a complaint about the lift" → Tool-use (insert into `Complaints`)
- "What did the March newsletter say about the water tank cleaning?" → RAG (notices/circulars)
- "Summarize my complaint history and tell me if there's a pattern" → Hybrid (tool-use to fetch rows, Claude reasons over them)

**Ask Claude:** *"Here are the modules in my society management system: [list your tables/features]. Here are example questions residents ask: [list]. Classify each as RAG, tool-use, or hybrid, and tell me what SQL Server tables or documents each one needs."* This gives you a concrete, reviewed spec before any code exists.

### Step 2 — Scaffold the solution

**Ask Claude:** *"Scaffold an ASP.NET Core 8 Web API solution called SocietyBot with projects for Api, Application (services/interfaces), Infrastructure (EF Core, SQL Server), and a separate /client folder for a Vite + React chat widget. Include appsettings structure for Claude API key, embeddings API key, and SQL connection string, with User Secrets for local dev."*

Review the generated `Program.cs`, DI registrations, and folder structure before moving on — this is your skeleton for everything else.

### Step 3 — Add the new schema (don't touch existing tables)

You already have Residents/Flats/Dues/Complaints/etc. Add new tables alongside them:

- `ChatSessions (Id, TenantId, ResidentId, StartedAt)`
- `ChatMessages (Id, TenantId, SessionId, Role, Content, CreatedAt)`
- `DocumentChunks (Id, TenantId, SourceDocument, ChunkText, ChunkIndex)`
- `ChunkEmbeddings (ChunkId, TenantId, Embedding VARBINARY(MAX) or VECTOR, EmbeddingModel)`

Every one of these carries `TenantId`, matching whatever your existing tables already use for tenant scoping (confirm the exact column name/type you use elsewhere — `TenantId`, `SocietyId`, etc. — and stay consistent).

**Ask Claude:** *"Here's my existing EF Core DbContext [paste it], including how [Residents/Dues/etc.] scope to a tenant today. Add entities and a migration for ChatSessions, ChatMessages, DocumentChunks, and ChunkEmbeddings, all scoped by the same tenant column, following the same conventions (naming, key types, soft-delete pattern, etc.) as my existing entities. Also set up a global EF Core query filter so tenant scoping is enforced automatically on every query against these tables, not just where I remember to add it."* Feeding it your existing conventions is what makes the generated code look like it belongs in your codebase rather than bolted on, and the global query filter closes the "forgot a WHERE clause" gap by default.

### Step 4 — Add SQL Server Row-Level Security (before building anything on top of these tables)

Do this now, right after the schema exists and before any ingestion/retrieval/tool code is written —
the whole point of RLS is that it protects the tables from day one, including from mistakes made in
code you haven't written yet. RLS has been available since SQL Server 2016, so it works on your
instance today; this is not something to defer to a pre-deploy hardening pass.

1. At the start of each authenticated request, set the resolved tenant ID into `SESSION_CONTEXT`
   (e.g. in middleware/an action filter, right after JWT validation, before any query runs).
2. Write a predicate function, e.g. `CREATE FUNCTION dbo.fn_TenantAccessPredicate(@TenantId ...)
   RETURNS TABLE ... WHERE @TenantId = CAST(SESSION_CONTEXT(N'TenantId') AS ...)`.
3. Bind it to `ChatSessions`, `ChatMessages`, `DocumentChunks`, and `ChunkEmbeddings` via
   `CREATE SECURITY POLICY ... ADD FILTER PREDICATE ... ADD BLOCK PREDICATE ...` (and, for the
   strongest guarantee, your existing tenant-scoped tables too).
4. Verify: query the tables directly from SSMS with a *different* `SESSION_CONTEXT` tenant set and
   confirm zero rows come back even though rows exist for another tenant.

**Ask Claude:** *"Write the SQL Server DDL for a Row-Level Security predicate function and security
policy that filters `ChatSessions`, `ChatMessages`, `DocumentChunks`, and `ChunkEmbeddings` by a
`TenantId` set via `SESSION_CONTEXT`, plus the ASP.NET Core middleware that sets `SESSION_CONTEXT`
from the authenticated user's tenant claim at the start of each request."* Doing this before Step 5
means every table this feature touches is protected by the database itself before a single row of
real data is written to it — not layered on after the feature already works.

### Step 5 — Build the ingestion pipeline

This is an offline/admin-triggered process, not part of the live chat path:

1. Pull source text: bylaws, circulars, FAQs, notices — either from SQL Server text columns or uploaded files (PDF/DOCX).
2. Chunk the text (roughly 300–600 tokens per chunk, with a little overlap between chunks so context isn't cut mid-thought).
3. Call the embeddings API for each chunk.
4. Store chunk text + embedding + source metadata (document name, section, date) in `DocumentChunks`/`ChunkEmbeddings`.

**Ask Claude:** *"Write an IngestionService in C# that takes a list of (sourceName, rawText), chunks it into ~500-token pieces with 50-token overlap, calls [Voyage AI / Azure OpenAI] embeddings via HttpClient, and bulk-inserts the results into DocumentChunks and ChunkEmbeddings using EF Core."* Re-run ingestion whenever a bylaw/circular/FAQ changes — treat it like a content-refresh job, e.g. triggered from an admin "Publish" button.

### Step 6 — Build the retrieval service

**Ask Claude:** *"Write an IRetrievalService with a SearchAsync(Guid tenantId, string query, int topK) method. It should embed the query using the same embeddings API, load candidate ChunkEmbeddings from SQL Server filtered to that TenantId first, compute cosine similarity in C# only over that filtered set, and return the topK chunks with their source metadata."* Keep this behind an interface from day one — it's the piece most likely to move to Azure AI Search or a dedicated vector DB later, and the tenant filter needs to carry over to whatever you swap in.

### Step 7 — Integrate Claude (Messages API)

Anthropic's officially maintained SDKs are Python and TypeScript; for .NET, check NuGet for a current community/official C# package (search "Anthropic" on nuget.org) before you start, since this landscape moves quickly — package names and maturity may have changed since this guide was written. Either way, the API is a plain HTTPS JSON endpoint, so a direct `HttpClient` call always works as a fallback and is worth knowing regardless of which SDK you pick:

```csharp
var request = new
{
    model = "claude-sonnet-4-5",  // check the current model list before hardcoding
    max_tokens = 1024,
    system = systemPrompt,
    messages = conversationHistory,   // [{role:"user", content:"..."}, ...]
    tools = toolDefinitions           // e.g. get_my_dues, get_complaint_status, create_complaint, book_amenity
};

var response = await httpClient.PostAsJsonAsync("https://api.anthropic.com/v1/messages", request);
// response may come back with stop_reason == "tool_use" — execute the requested tool
// against SQL Server (via your existing services, scoped to the logged-in resident),
// then send the tool result back in a follow-up message to get the final answer.
```

**Ask Claude:** *"Write a ClaudeClient class that wraps the Messages API over HttpClient, supports streaming (server-sent events), and implements the tool-use loop: send messages + tools, if stop_reason is tool_use then execute the matching local method and post the tool_result back, repeat until a final text response comes back."* This tool-use loop is the piece most people get wrong on the first pass — ask Claude to include the loop-termination logic (max iterations) and error handling for a tool call failing.

Define your SQL-backed tools narrowly and defensively, e.g.:

- `get_my_dues(tenantId, residentId)` — never accept a tenantId or residentId from the model's own reasoning; inject both from the *authenticated* session server-side, ignoring anything the model might pass.
- `get_complaint_status(tenantId, complaintId, residentId)` — verify the complaint belongs to that resident *and* that tenant before returning anything.
- `create_complaint(tenantId, residentId, category, description)`
- `book_amenity(tenantId, residentId, amenityId, date, slot)`

### Step 8 — Build the chat orchestration endpoint

**Ask Claude:** *"Write a ChatController with a POST /api/chat/message endpoint that: loads the session's recent history from SQL Server, calls RetrievalService for relevant chunks, builds a system prompt that includes the retrieved chunks as context and instructs Claude to cite which source each fact came from, calls ClaudeClient with the tool definitions scoped to the current authenticated resident, saves the exchange to ChatMessages, and streams the response back to the client."*

A system prompt sketch to hand Claude as a starting point:

> You are the assistant for [Society Name]'s resident portal. Answer only using the provided context and tool results. If the context doesn't contain the answer, say you don't have that information rather than guessing. When you use a tool result, present it plainly (e.g., "Your outstanding maintenance is ₹X as of [date]"). When you use retrieved document context, mention which document it came from. Never invent amounts, dates, or policy details.

Build this string per request from the resolved tenant's own settings (society name, any tenant-specific policies) rather than hardcoding it — it's the one piece of the prompt that's genuinely different per society.

### Step 9 — Build the React chat UI

**Ask Claude:** *"Build a React chat widget component (functional, hooks-based) that posts to /api/chat/message, renders a streaming response token-by-token via SSE/fetch streaming, shows a typing indicator, and displays source citations under any answer that used retrieved documents."* Keep it a single self-contained component to start — you can split it up once the interaction pattern is settled.

### Step 10 — Security and access control

This matters more here than in a generic chatbot, because you're exposing personal financial and complaint data:

- Authenticate every chat request (JWT tied to the logged-in resident, carrying both tenant and resident ID); never trust a tenant/resident/flat ID that arrives from the client or from the model's tool-call arguments — always resolve it server-side from the authenticated session.
- Scope every SQL tool call and every retrieval query to the authenticated tenant *and* resident (or, for admins, to their permitted scope) at the query level, not just in the prompt — a prompt instruction like "only show this user their own data" is not a security boundary. This should already be backed by the SQL Server Row-Level Security you set up in Step 4 — if you skipped it, this is your last chance to add it before deploy, not a nice-to-have.
- Rate-limit the chat endpoint per user to control both cost and abuse.
- Log prompts/responses for audit, but redact or encrypt sensitive fields (financial amounts, personal identifiers) in long-term storage per your data-retention policy.
- Treat retrieved document content as untrusted input for prompt-injection purposes — instruct Claude (in the system prompt) to treat document content as reference material only, never as instructions to follow.

### Step 11 — Test, then deploy

Build a small fixed set of test questions covering each category from Step 1 (RAG, tool-use, hybrid) and check answers for accuracy and correct source attribution before every release — this is the closest thing to a regression suite for a RAG system, since there's no compiler to catch "the answer is subtly wrong."

For deployment: host the API on Azure App Service/IIS as usual, put the Claude and embeddings API keys in Azure Key Vault (never in appsettings.json), and add basic usage/cost monitoring on the Claude API calls (token counts per conversation) so a runaway loop or an unusually long conversation doesn't surprise you on the bill.

## Suggested Build Checklist

1. Scope use cases and tag RAG vs. tool-use vs. hybrid
2. Confirm tenant isolation model (shared DB + TenantId, assumed below) and stay consistent with existing tables
3. Scaffold .NET Core solution + React client
4. Add ChatSessions/ChatMessages/DocumentChunks/ChunkEmbeddings schema, each carrying TenantId, with an EF Core global query filter enforcing it
5. Add SQL Server Row-Level Security on the new tables as a second enforcement layer
6. Build ingestion pipeline (chunk + embed + store, tagged per tenant)
7. Build retrieval service (tenant-filtered first, then cosine similarity or vector search)
8. Build ClaudeClient (Messages API + streaming + tool-use loop)
9. Define and secure SQL-backed tools, each scoped by TenantId + ResidentId resolved server-side (dues, complaints, bookings)
10. Build ChatController orchestrating retrieval + tools + generation, with a per-tenant system prompt
11. Build React chat widget with streaming + citations
12. Build a test question set — including a cross-tenant leak test — and validate before each release
13. Deploy with secrets in Key Vault, move off Developer Edition for production, and add per-tenant usage monitoring

## A note on working with Claude through this build

Because this is exactly the kind of multi-week build where context gets lost between sessions, it helps to keep a short running spec (even just this checklist plus your schema) that you paste back in at the start of each new session, and to ask for one layer at a time — schema, then ingestion, then retrieval, then the Claude integration, then the UI — reviewing and running each before moving to the next, rather than asking for the whole stack in one shot.
