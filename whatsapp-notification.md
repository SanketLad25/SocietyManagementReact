# WhatsApp Notification Module — Design Plan

## 0. Context & how this fits the existing app

This plan extends the existing multi-tenant Society Management app (`ReactPractice` frontend +
`SociectyManagementCore` backend + SQL Server `Society Management` DB), following the same
research-first, reuse-what-exists discipline as `maintenance.md` and `notice.md`. A background
research pass confirmed the following ground truth before any design decisions below were made:

- **The integration seam already exists.** `notice.md` §4/§11 designed `INoticeBroadcastService`
  specifically so a real WhatsApp implementation could be dropped in later via DI alone, with
  `NoOpNoticeBroadcastService` as a placeholder:
  ```csharp
  public interface INoticeBroadcastService
  {
      Task BroadcastAsync(Notice notice, IReadOnlyList<NoticeAttachment> attachments);
  }
  ```
  registered at `Program.cs:50`. `NoticeService.PublishAsync` already calls this on every publish.
  **This plan's `WhatsAppNoticeBroadcastService` implements this exact interface** — no change to
  `NoticeService` is needed, only a DI registration swap.
- **No background job/scheduling infrastructure exists anywhere.** Grepped the whole backend for
  `IHostedService`, `BackgroundService`, `Hangfire`, `Quartz`, `Timer`, `PeriodicTimer` — zero
  matches, and the `.csproj` (§0a below) confirms neither package is referenced. Asynchronous
  sending and scheduled/recurring broadcasts are genuinely new infrastructure for this codebase, not
  a reuse (see §7).
- **No reversible encryption exists anywhere.** The only crypto in the codebase is
  `BCrypt.Net-Next` (one-way password hashing). There is no `IDataProtector`, no `Aes`/`Rijndael`
  usage, nothing to round-trip a secret back out. Per-society WhatsApp API keys/tokens *must* be
  reversible (they get sent back out to the provider), so this needs a real answer, not a reuse of
  BCrypt — see §4.
- **Repository Pattern and CQRS do not exist anywhere in this codebase.** Grepped for
  `interface I.*Repository` (zero matches) and `MediatR` (zero matches, also absent from the
  `.csproj`). Every existing module — Residents, Flats, Maintenance, Notices — follows "thin
  Controller → fat Service (constructor-injects `SocietyDbContext` directly) → `ServiceResult<T>`."
  The user's request explicitly asks for Repository Pattern and CQRS "where applicable" for this
  module specifically. **This is a genuine deviation from house style, built as asked and flagged
  explicitly** rather than silently normalized either direction — see §1 and the open decisions in
  §15.
- **Trigger-domain reality check.** The request lists notices, maintenance billing, payment
  reminders, event announcements, emergency alerts, complaint updates, and visitor notifications as
  things that should trigger a WhatsApp send. Backend `Controllers/`/`Services/` and frontend
  `dashboardNav.js`/`App.jsx` confirm: **only Notices and Maintenance have real modules today.**
  Complaints, Events, Visitors, and Parking (the actual visitor/vehicle module, distinct from the
  `ParkingTypes` maintenance-reference table) are all still `ComingSoon` placeholders with zero
  backend code. This plan designs the trigger/broadcast architecture to be generically extensible to
  all seven domains, but **only Notice broadcasting and a generic ad-hoc "Emergency Alert" trigger
  are buildable now** — Payment Reminders needs a query against `MaintenanceBill`/`Payment` that
  doesn't exist yet either, and Complaint/Event/Visitor triggers cannot be wired until those modules
  themselves exist. Phasing (§16) reflects this honestly instead of describing all seven as equally
  actionable today.
- **`Resident.Mobile`** (`string?`) is the only phone-number field in the schema — confirmed via
  `Resident.cs`. This is the field used to determine WhatsApp reachability; residents with a null/
  blank `Mobile` are simply excluded from recipient resolution (§6), not treated as an error.
- **Multi-tenancy, audit, and DI conventions are reused as-is**: `ITenantScoped`/`IAuditable`,
  `SocietyDbContext.SaveChangesAsync` auto-stamping, `ICurrentUserContext`, manual
  `builder.Services.AddScoped<X>()` registration style in `Program.cs` (no extension-method
  modularization exists to follow either). The existing `ICalculationStrategy` registration —
  multiple implementations of one interface registered side by side (`Program.cs:34-39`) and
  resolved via a factory — is the one existing precedent for this module's provider/recipient-
  resolver strategy pattern (§2/§6).
- **Existing `AuditLog` table is reused, not duplicated**, for the "audit logs" requirement — every
  mutating WhatsApp service call writes through the existing `AuditLogService.LogAsync`, exactly
  like every other module (§11).

### 0a. NuGet packages (confirmed current state)

```xml
BCrypt.Net-Next 4.2.0
Microsoft.AspNetCore.Authentication.JwtBearer 9.0.9
Microsoft.AspNetCore.OpenApi 9.0.9
Microsoft.EntityFrameworkCore.SqlServer 9.0.9
NCalcSync 7.0.0
```
No Hangfire, Quartz, MediatR, Polly, or data-protection package beyond what ships implicitly with
the ASP.NET Core shared framework (which includes Data Protection — no new package needed, §4).

## 1. Design philosophy

| Concern | Modeled as | Why |
|---|---|---|
| **Provider abstraction** | Strategy pattern: `IWhatsAppProvider` interface, one concrete class per provider, resolved by a factory keyed on a `ProviderKey` string, registered via multiple `AddScoped<IWhatsAppProvider, X>()` calls in `Program.cs` | Same shape as the existing `ICalculationStrategy` registration (§0) — the only precedent for "many implementations of one interface" already in this codebase. Adding `MetaCloudApiProvider` later = one new class + one enum value + one DI line; `WhatsAppNotificationService`, every controller, and every other service touching WhatsApp stays untouched (proved concretely in §3). |
| **Per-society configuration** | New `WhatsAppProviderConfig` table, one row per society, `ITenantScoped`, secrets encrypted at rest (§4) | Matches the multi-tenant isolation guarantee every other module has — a society's Admin manages only their own row, never sees another society's credentials. |
| **Repository Pattern** | **Introduced for this module only** — `IWhatsAppProviderConfigRepository`, `IWhatsAppTemplateRepository`, `IWhatsAppBroadcastRepository`, `IWhatsAppMessageLogRepository`, each backed by a thin EF-Core-based concrete class | **Explicit deviation, built as requested.** No other module in this codebase has repository interfaces — Residents/Flats/Maintenance/Notices all inject `SocietyDbContext` straight into their services. Flagged in §15 for confirmation rather than silently matched to house style or silently introduced without comment. |
| **CQRS** | **"CQRS-lite" — command/query objects + explicit handler methods on the services below, not a mediator pipeline.** E.g. `SendBroadcastCommand`/`GetBroadcastHistoryQuery` as plain DTOs, handled directly by `WhatsAppBroadcastService.SendBroadcastAsync(command)` / `.GetHistoryAsync(query)` | No MediatR (or any CQRS library) exists in this codebase, and introducing one is a bigger footprint than this module needs. This gets the *separation* CQRS asks for (distinct read/write DTOs and methods, no service method that both mutates and returns a live query result) without a new dependency or an app-wide pipeline. Flagged in §15 as an interpretation, not a literal MediatR-based CQRS. |
| **Secrets at rest** | ASP.NET Core's built-in Data Protection API (`IDataProtector`), purpose-string per society | Ships with the shared framework already referenced (`Microsoft.AspNetCore.OpenApi`/`Web` SDK) — no new package. Reversible, unlike BCrypt. See §4. |
| **Background/async sending + scheduling** | A single homegrown `BackgroundService` (`WhatsAppBroadcastProcessor`) polling loop | No Hangfire/Quartz exists; adding one is flagged as a future enhancement (§17) if volume ever demands true distributed job scheduling. A polling `BackgroundService` is the smallest thing that satisfies "send asynchronously," "retry failed messages," and "schedule for a future date" today — see §7. |
| **Recipient resolution** | `IWhatsAppRecipientResolver`, one implementation per trigger type, resolved by a factory keyed on `WhatsAppTriggerType` | **Not** one blanket "get all active members with a mobile number" query reused everywhere — a Notice broadcast plausibly means all residents, but a Payment Reminder must resolve only residents with *that specific* outstanding bill, and an Emergency Alert plausibly includes committee + security too. Modeling this as one shared query would silently produce a real bug (e.g. every resident getting spammed about one flat's unpaid bill) the moment Payment Reminders is built. See §6. |

### Proving the extensibility claim

The requirement is "adding a new provider requires zero business-logic changes." Concretely, adding
Meta WhatsApp Cloud API later means:
1. One new class, `MetaCloudApiProvider : IWhatsAppProvider`, implementing `SendMessageAsync`/
   `TestConnectionAsync` against Meta's actual HTTP contract.
2. One new entry in the `WhatsAppProviderKeys` static list (mirrors `RoleNames`'/`NoticePriorities`'
   shape) — `"MetaCloudApi"`.
3. One new DI line in `Program.cs`: `builder.Services.AddScoped<IWhatsAppProvider,
   MetaCloudApiProvider>();`.
4. A society's Admin picks `"MetaCloudApi"` from a dropdown in the existing config UI and fills in
   the same generic fields (§2.1) — no new UI code either, since the config form is already generic
   (ApiUrl/ApiKey/AuthToken/SenderNumber/InstanceId/`ExtraSettingsJson` for anything provider-
   specific).

`WhatsAppNotificationService`, `WhatsAppBroadcastService`, every controller, and every DTO are
untouched by this addition — the factory looks up the right `IWhatsAppProvider` by `ProviderKey` at
send time, same pattern as `ICalculationStrategy` resolution today.

## 2. Provider abstraction

### 2.1 `IWhatsAppProvider` interface

```csharp
public interface IWhatsAppProvider
{
    string ProviderKey { get; } // "WireWeb", matches WhatsAppProviderConfig.ProviderKey

    Task<WhatsAppSendResult> SendMessageAsync(
        WhatsAppProviderConfig config,
        WhatsAppOutboundMessage message,
        CancellationToken cancellationToken);

    Task<WhatsAppConnectionTestResult> TestConnectionAsync(
        WhatsAppProviderConfig config,
        CancellationToken cancellationToken);
}

public record WhatsAppOutboundMessage(string ToMobile, string Body, IReadOnlyList<string>? MediaUrls);
public record WhatsAppSendResult(bool Success, string? ProviderMessageId, string? ErrorMessage, string? RawResponseJson);
public record WhatsAppConnectionTestResult(bool Success, string? ErrorMessage);
```

Designed generically against the configured fields the user specified (`ApiUrl`, `ApiKey`,
`AuthToken`, `SenderNumber`, `InstanceId`) plus a provider-specific `ExtraSettingsJson` escape hatch,
so any additional provider (Meta Cloud API, Whapi.Cloud, Gupshup, Twilio) can be built against the
same shape without a schema change.

### 2.2 `WireWebWhatsAppProvider` — first concrete implementation

**Flagged explicitly**: "WireWeb" is not a WhatsApp provider with a publicly documented HTTP
contract known ahead of time. This plan builds `WireWebWhatsAppProvider` against the generic
configured fields (`ApiUrl` + `ApiKey`/`AuthToken` as bearer/header auth, `SenderNumber`,
`InstanceId` as a path or payload field) using the most common shape for this category of WhatsApp
gateway API (HTTP POST to `{ApiUrl}/send`, JSON body `{ instanceId, to, message, token }`, response
`{ status, messageId }`) — but **the exact request/response contract must be confirmed against
WireWeb's actual API docs before Phase 0 is implemented**, not assumed from the field names alone.
`ExtraSettingsJson` exists precisely so provider quirks discovered at implementation time don't
require a schema change.

### 2.3 Provider factory

```csharp
public interface IWhatsAppProviderFactory
{
    IWhatsAppProvider Resolve(string providerKey);
}

public class WhatsAppProviderFactory : IWhatsAppProviderFactory
{
    private readonly IEnumerable<IWhatsAppProvider> _providers;
    public WhatsAppProviderFactory(IEnumerable<IWhatsAppProvider> providers) => _providers = providers;

    public IWhatsAppProvider Resolve(string providerKey) =>
        _providers.FirstOrDefault(p => p.ProviderKey == providerKey)
        ?? throw new InvalidOperationException($"No WhatsApp provider registered for key '{providerKey}'.");
}
```

`Program.cs` registers every `IWhatsAppProvider` implementation plus the factory:
```csharp
builder.Services.AddScoped<IWhatsAppProvider, WireWebWhatsAppProvider>();
builder.Services.AddScoped<IWhatsAppProviderFactory, WhatsAppProviderFactory>();
```

## 3. Database schema

All new tables are `ITenantScoped` (carry `SocietyId`, filtered by `ICurrentUserContext` in every
service) and `IAuditable` (`CreatedOn`/`CreatedBy`/`ModifiedOn`/`ModifiedBy`, auto-stamped by the
existing `SocietyDbContext.SaveChangesAsync` override) unless noted otherwise. New migration file:
`database/009_whatsapp_notifications.sql` (next after `008_notice_management.sql`).

### 3.1 `WhatsAppProviderConfig` — one row per society

| Column | Type | Notes |
|---|---|---|
| WhatsAppProviderConfigId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | UNIQUE — one config per society |
| ProviderKey | NVARCHAR(50) NOT NULL | e.g. `"WireWeb"` — validated against `WhatsAppProviderKeys.All` |
| ApiUrl | NVARCHAR(500) NULL | not secret, stored plain |
| ApiKeyEncrypted | NVARCHAR(1000) NULL | protected via `IDataProtector`, purpose-scoped per society (§4) |
| AuthTokenEncrypted | NVARCHAR(1000) NULL | same protection as ApiKeyEncrypted |
| SenderNumber | NVARCHAR(20) NULL | |
| InstanceId | NVARCHAR(100) NULL | |
| ExtraSettingsJson | NVARCHAR(MAX) NULL | provider-specific overflow, e.g. `{"webhookUrl": "..."}` |
| IsEnabled | BIT NOT NULL DEFAULT 0 | Admin's on/off switch (§8) — WhatsApp sends are skipped entirely when false |
| Audit columns | | |

### 3.2 `WhatsAppTemplate` — reusable message templates, per society

| Column | Type | Notes |
|---|---|---|
| WhatsAppTemplateId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| TemplateKey | NVARCHAR(50) NOT NULL | e.g. `"NoticeBroadcast"`, `"PaymentReminder"`, `"EmergencyAlert"` |
| Name | NVARCHAR(150) NOT NULL | display name in the admin UI |
| TriggerType | NVARCHAR(50) NOT NULL | `WhatsAppTriggerType` value (§6) this template applies to |
| BodyText | NVARCHAR(1000) NOT NULL | supports `{{placeholder}}` merge fields, e.g. `{{ResidentName}}`, `{{NoticeTitle}}` |
| IsActive | BIT NOT NULL DEFAULT 1 | |
| Audit columns | | UNIQUE (SocietyId, TemplateKey) |

Seeded with one starter template per trigger type at society creation (same hook shape as
`NoticeCategory`'s starter-list seed in `notice.md` §2.1a).

### 3.3 `WhatsAppBroadcastJob` — one row per broadcast (immediate or scheduled)

| Column | Type | Notes |
|---|---|---|
| WhatsAppBroadcastJobId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL FK→Society | |
| TriggerType | NVARCHAR(50) NOT NULL | `WhatsAppTriggerType` (§6) |
| SourceEntityType | NVARCHAR(50) NULL | e.g. `"Notice"` — polymorphic reference, not an FK, so future trigger types (Complaint, Event) don't need schema changes |
| SourceEntityId | INT NULL | e.g. the `NoticeId`, paired with `SourceEntityType` |
| WhatsAppTemplateId | INT NULL FK→WhatsAppTemplate | |
| Status | NVARCHAR(20) NOT NULL DEFAULT 'Draft' | `Draft` → `Scheduled` → `Processing` → `Completed` \| `PartiallyFailed` \| `Failed` \| `Cancelled` |
| ScheduledAt | DATETIME NULL | NULL = send as soon as the processor picks it up; future value = scheduled (§7) |
| RecurrenceRule | NVARCHAR(50) NULL | `None`/`Daily`/`Weekly` — designed in now, not built until Phase 3 (§16) |
| TotalRecipients | INT NOT NULL DEFAULT 0 | denormalized count, refreshed as recipients resolve |
| SentCount | INT NOT NULL DEFAULT 0 | |
| FailedCount | INT NOT NULL DEFAULT 0 | |
| StartedOn | DATETIME NULL | |
| CompletedOn | DATETIME NULL | |
| Audit columns | | `CreatedBy` = the Admin who initiated it |

### 3.4 `WhatsAppBroadcastRecipient` — one row per recipient per job

| Column | Type | Notes |
|---|---|---|
| WhatsAppBroadcastRecipientId | INT PK IDENTITY | |
| WhatsAppBroadcastJobId | INT NOT NULL FK→WhatsAppBroadcastJob | |
| SocietyId | INT NOT NULL | denormalized, same documented exception as `NoticeAttachment.SocietyId` in `notice.md` §2.2 — direct tenant filtering without a join |
| ResidentId | INT NULL FK→Resident | |
| MobileNumber | NVARCHAR(20) NOT NULL | snapshotted at resolve time — if a resident later changes their number, this historical row still reflects what was actually sent to |
| Status | NVARCHAR(20) NOT NULL DEFAULT 'Pending' | `Pending` → `Sent` \| `Delivered` \| `Failed` \| `Cancelled` — this column *is* the "message status" requirement; no separate status table (§15) |
| WhatsAppMessageLogId | INT NULL FK→WhatsAppMessageLog | set once a send attempt is made |
| RetryCount | INT NOT NULL DEFAULT 0 | |
| NextRetryAt | DATETIME NULL | set by the processor on failure (§7) |
| LastError | NVARCHAR(500) NULL | |
| Audit columns | | (`CreatedOn`/`ModifiedOn` only — no separate `CreatedBy`, system-generated) |

### 3.5 `WhatsAppMessageLog` — every actual send attempt (history)

| Column | Type | Notes |
|---|---|---|
| WhatsAppMessageLogId | INT PK IDENTITY | |
| SocietyId | INT NOT NULL | |
| WhatsAppBroadcastRecipientId | INT NULL FK→WhatsAppBroadcastRecipient | NULL for a one-off `WhatsAppNotificationService.SendAsync` call not part of a broadcast |
| ToMobile | NVARCHAR(20) NOT NULL | |
| ProviderKey | NVARCHAR(50) NOT NULL | which provider handled this specific send |
| RenderedBody | NVARCHAR(1000) NOT NULL | the template after merge-field substitution |
| ProviderMessageId | NVARCHAR(100) NULL | external id returned by the provider, for delivery-status correlation |
| RequestPayloadJson | NVARCHAR(MAX) NULL | logged per requirement ("log every request and response") |
| ResponsePayloadJson | NVARCHAR(MAX) NULL | |
| Success | BIT NOT NULL | |
| ErrorMessage | NVARCHAR(500) NULL | |
| SentOn | DATETIME NOT NULL | |
| Audit columns | | insert-only, no `ModifiedOn`/`ModifiedBy` — same exemption pattern as `AuditLog` |

### 3.6 `WhatsAppRetryAttempt` — full retry history per recipient

| Column | Type | Notes |
|---|---|---|
| WhatsAppRetryAttemptId | INT PK IDENTITY | |
| WhatsAppBroadcastRecipientId | INT NOT NULL FK→WhatsAppBroadcastRecipient | |
| AttemptNumber | INT NOT NULL | 1, 2, 3... |
| AttemptedOn | DATETIME NOT NULL | |
| Success | BIT NOT NULL | |
| ErrorMessage | NVARCHAR(500) NULL | |

Kept as its own table (rather than folded into `WhatsAppMessageLog`) per the user's literal request
for a dedicated retry-attempts table — gives a clean per-recipient retry timeline independent of the
message log.

### 3.7 Audit logs and scheduling — reused, not new tables

- **Audit logs**: every mutating WhatsApp service call writes through the existing
  `AuditLogService.LogAsync` into the existing `AuditLog` table — same as every other module. No new
  `WhatsAppAuditLog` table (flagged in §15 as an intentional simplification against the literal
  request's table list).
- **Scheduling**: modeled as `ScheduledAt`/`RecurrenceRule` columns on `WhatsAppBroadcastJob` (§3.3),
  not a separate `WhatsAppSchedule` table — there's nothing schedule-related that isn't already an
  attribute of "when should this specific job run."

## 4. Secrets & encryption at rest

Since no reversible-encryption pattern exists anywhere in this codebase (§0), this is designed fresh
using ASP.NET Core's built-in Data Protection API — ships with the already-referenced
`Microsoft.AspNetCore.OpenApi`/Web SDK, no new package.

```csharp
builder.Services.AddDataProtection(); // Program.cs — persists keys to the default local key ring
```

`WhatsAppProviderConfigService` constructor-injects `IDataProtectionProvider` and creates a
per-society protector on demand:
```csharp
var protector = _dataProtectionProvider.CreateProtector($"WhatsAppProviderConfig:{societyId}");
var encrypted = protector.Protect(rawApiKey);
var decrypted = protector.Unprotect(config.ApiKeyEncrypted);
```
Using a **per-society purpose string** means even if `WhatsAppProviderConfig` rows leaked across
tenants (a bug elsewhere), one society's protector could not decrypt another's ciphertext. Only
`WhatsAppProviderConfigService` and `WhatsAppNotificationService` (at send time) ever call
`Unprotect` — the raw secret is never included in any DTO/API response (§9's `WhatsAppProviderConfigResponse`
masks both fields, e.g. `"••••1234"` showing only a trailing fragment, same convention as most
provider dashboards).

## 5. Multi-tenant configuration & portal capabilities

`WhatsAppProviderConfigService` (Admin-only, §10):
- `GetAsync()` — the caller's own society's config, secrets masked.
- `UpsertAsync(request)` — create or update; `ProviderKey` validated against
  `WhatsAppProviderKeys.All`; secrets encrypted before storage (§4).
- `TestConnectionAsync()` — decrypts the stored secrets, resolves the configured
  `IWhatsAppProvider` via the factory, calls `TestConnectionAsync(config)`, returns
  `WhatsAppConnectionTestResult` directly to the Admin without persisting anything.
- `SetEnabledAsync(bool)` — the on/off switch (§8's "Enable or disable WhatsApp integration").

## 6. Recipient resolution

```csharp
public enum WhatsAppTriggerType
{
    Notice, MaintenanceBillGenerated, PaymentReminder, EventAnnouncement,
    EmergencyAlert, ComplaintUpdate, VisitorNotification, Custom
}

public interface IWhatsAppRecipientResolver
{
    WhatsAppTriggerType TriggerType { get; }
    Task<IReadOnlyList<WhatsAppRecipientCandidate>> ResolveAsync(int societyId, int? sourceEntityId, CancellationToken ct);
}

public record WhatsAppRecipientCandidate(int? ResidentId, string MobileNumber);
```

One implementation per trigger type, resolved via a factory keyed on `WhatsAppTriggerType` (same
shape as the provider factory, §2.3):
- `NoticeBroadcastRecipientResolver` — all active `Resident` rows in the society with a non-blank
  `Mobile`. **Buildable now** — this is the Phase 1 integration.
- `EmergencyAlertRecipientResolver` — same as above, generic "everyone" resolver, reused for ad-hoc
  emergency alerts. **Buildable now.**
- `PaymentReminderRecipientResolver` (future, Phase 4) — residents with a specific outstanding
  `MaintenanceBill`, not the whole society. **Not built until this phase**, since it needs the
  outstanding-bill query designed alongside it.
- `ComplaintUpdateRecipientResolver`/`EventAnnouncementRecipientResolver`/
  `VisitorNotificationRecipientResolver` (future, Phase 4+) — **cannot be built** until Complaints/
  Events/Visitors themselves exist as real modules (§0).

## 7. Core services & async/background processing

### 7.1 `WhatsAppNotificationService` — single-message send

```csharp
public interface IWhatsAppNotificationService
{
    Task<ServiceResult<WhatsAppSendResult>> SendAsync(int societyId, string toMobile, string renderedBody, CancellationToken ct);
}
```
Looks up the society's `WhatsAppProviderConfig` (fails fast with a friendly error if disabled or
unconfigured), decrypts secrets (§4), resolves the `IWhatsAppProvider` via the factory (§2.3), calls
`SendMessageAsync`, writes one `WhatsAppMessageLog` row with the full request/response JSON
regardless of success/failure, and returns the result. This is the single choke point every other
service (broadcast engine, future ad-hoc sends) goes through — logging and provider resolution are
never duplicated.

### 7.2 `WhatsAppBroadcastService` — the generic fan-out engine

```csharp
public interface IWhatsAppBroadcastService
{
    Task<ServiceResult<int>> CreateBroadcastAsync(WhatsAppCreateBroadcastCommand command, CancellationToken ct);
    Task<ServiceResult<WhatsAppBroadcastDetailResponse>> GetBroadcastAsync(WhatsAppGetBroadcastQuery query, CancellationToken ct);
    Task<ServiceResult<PagedResult<WhatsAppBroadcastSummaryResponse>>> GetHistoryAsync(WhatsAppGetHistoryQuery query, CancellationToken ct);
    Task<ServiceResult<bool>> CancelAsync(int broadcastJobId, CancellationToken ct);
    Task<ServiceResult<bool>> RetryFailedAsync(int broadcastJobId, CancellationToken ct);
}
```
`CreateBroadcastAsync`: creates a `WhatsAppBroadcastJob` row (`Draft`), resolves recipients via the
trigger-appropriate `IWhatsAppRecipientResolver` (§6), bulk-inserts `WhatsAppBroadcastRecipient` rows
(`Pending`), sets `Status = Scheduled` (whether `ScheduledAt` is now or future — the processor, §7.3,
treats both the same way), and returns immediately — actual sending is always asynchronous, never
in-request, satisfying the "thousands of members" scale requirement (contrast with
`MaintenanceBillingService.GenerateAsync`'s documented in-request limitation).

### 7.3 `WhatsAppNoticeBroadcastService` — the Notice-specific adapter

```csharp
public class WhatsAppNoticeBroadcastService : INoticeBroadcastService
{
    public async Task BroadcastAsync(Notice notice, IReadOnlyList<NoticeAttachment> attachments)
    {
        await _broadcastService.CreateBroadcastAsync(new WhatsAppCreateBroadcastCommand
        {
            SocietyId = notice.SocietyId,
            TriggerType = WhatsAppTriggerType.Notice,
            SourceEntityType = "Notice",
            SourceEntityId = notice.NoticeId,
            TemplateKey = "NoticeBroadcast",
            ScheduledAt = null, // immediate
        }, CancellationToken.None);
    }
}
```
This is the **only** change needed to wire WhatsApp into Notices: swap the `Program.cs` DI
registration from `NoOpNoticeBroadcastService` to this class. `NoticeService.PublishAsync` itself
never changes, exactly as `notice.md` §4 promised.

### 7.4 `WhatsAppBroadcastProcessor` — background sender

```csharp
public class WhatsAppBroadcastProcessor : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessDueJobsAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}
```
Each poll: picks up `WhatsAppBroadcastJob` rows that are `Scheduled` with `ScheduledAt <= now` (or
`Processing` jobs with unfinished `Pending`/retry-due recipients), marks the job `Processing`, then
for each `Pending` (or `NextRetryAt <= now`) recipient calls `WhatsAppNotificationService.SendAsync`
with bounded concurrency (`SemaphoreSlim`, e.g. 5 concurrent) to respect provider rate limits.
On success: recipient → `Sent`, `WhatsAppMessageLogId` set. On failure: increments `RetryCount`,
writes a `WhatsAppRetryAttempt` row, and if under a configured max (3, exponential backoff — 1 min,
5 min, 30 min) sets `NextRetryAt`; otherwise marks the recipient `Failed` permanently. Once every
recipient reaches a terminal state, the job flips to `Completed`/`PartiallyFailed`/`Failed`.
`Cancelled` jobs (§7.2's `CancelAsync`, only valid pre-`Processing` or mid-`Processing` for
still-`Pending` recipients) are skipped by the poll. Registered in `Program.cs`:
```csharp
builder.Services.AddHostedService<WhatsAppBroadcastProcessor>();
```
This single loop satisfies "send asynchronously," "retry failed messages," "schedule broadcasts for
a future date," and (via `RecurrenceRule`, Phase 3) "recurring notifications" without a new
dependency — flagged in §17 as something to revisit for Hangfire/Quartz only if polling-interval
latency or multi-instance deployment ever becomes a real constraint.

## 8. Repositories & CQRS-lite (per user's explicit request, §1)

```csharp
public interface IWhatsAppProviderConfigRepository
{
    Task<WhatsAppProviderConfig?> GetBySocietyAsync(int societyId, CancellationToken ct);
    Task UpsertAsync(WhatsAppProviderConfig config, CancellationToken ct);
}

public interface IWhatsAppTemplateRepository
{
    Task<IReadOnlyList<WhatsAppTemplate>> ListAsync(int societyId, CancellationToken ct);
    Task<WhatsAppTemplate?> GetAsync(int societyId, int templateId, CancellationToken ct);
    Task AddAsync(WhatsAppTemplate template, CancellationToken ct);
    Task UpdateAsync(WhatsAppTemplate template, CancellationToken ct);
}

public interface IWhatsAppBroadcastRepository
{
    Task AddJobAsync(WhatsAppBroadcastJob job, CancellationToken ct);
    Task AddRecipientsAsync(IEnumerable<WhatsAppBroadcastRecipient> recipients, CancellationToken ct);
    Task<WhatsAppBroadcastJob?> GetJobAsync(int societyId, int jobId, CancellationToken ct);
    Task<PagedResult<WhatsAppBroadcastJob>> GetHistoryAsync(int societyId, int page, int pageSize, CancellationToken ct);
    Task<IReadOnlyList<WhatsAppBroadcastRecipient>> GetRecipientsAsync(int jobId, CancellationToken ct);
    Task<IReadOnlyList<WhatsAppBroadcastJob>> GetDueJobsAsync(DateTime asOf, CancellationToken ct); // used by the processor, §7.4
}

public interface IWhatsAppMessageLogRepository
{
    Task AddAsync(WhatsAppMessageLog log, CancellationToken ct);
    Task<IReadOnlyList<WhatsAppMessageLog>> GetForRecipientAsync(int societyId, string mobileNumber, CancellationToken ct); // used by §10's "notifications intended for them" view
}
```
Each is a thin EF-Core-backed class in `Services/WhatsApp/Repositories/` — no query logic beyond
what's shown, no generic `IRepository<T>` base (that would be inventing an abstraction this codebase
has never used, and the user asked for concrete repository interfaces per concern, not a generic
data-access layer).

Commands/queries (CQRS-lite, §1) are plain records in `Models/Dtos/WhatsApp/`:
```csharp
public record WhatsAppCreateBroadcastCommand(int SocietyId, WhatsAppTriggerType TriggerType, string? SourceEntityType, int? SourceEntityId, string TemplateKey, DateTime? ScheduledAt);
public record WhatsAppGetBroadcastQuery(int SocietyId, int BroadcastJobId);
public record WhatsAppGetHistoryQuery(int SocietyId, int Page, int PageSize);
```
Handled directly by `WhatsAppBroadcastService` methods (§7.2) — no mediator, no pipeline behaviors,
just named, single-purpose DTOs that separate "this call changes state" from "this call reads state"
the way CQRS asks for, without a new library (§1).

## 9. API design

| Resource | Endpoints | Read access | Write access |
|---|---|---|---|
| Provider config | `GET/PUT /api/whatsapp/config`, `POST /api/whatsapp/config/enable`, `POST /api/whatsapp/config/disable`, `POST /api/whatsapp/config/test-connection` | `RoleNames.Admin` | `RoleNames.Admin` |
| Templates | `GET/POST /api/whatsapp/templates`, `PUT/DELETE /api/whatsapp/templates/{id}`, `POST /api/whatsapp/templates/{id}/preview` | `RoleNames.Admin` | `RoleNames.Admin` |
| Broadcasts | `POST /api/whatsapp/broadcasts` (send now or schedule), `GET /api/whatsapp/broadcasts` (history), `GET /api/whatsapp/broadcasts/{id}` (detail + recipient-wise status), `POST /api/whatsapp/broadcasts/{id}/cancel`, `POST /api/whatsapp/broadcasts/{id}/retry-failed` | `RoleNames.Admin` | `RoleNames.Admin` |
| Stats | `GET /api/whatsapp/stats` (sent/delivered/failed counts, per period) | `RoleNames.Admin` | — |
| My notifications | `GET /api/whatsapp/notifications/mine` — the caller's own received messages (matched by their `Resident.Mobile`) | any authenticated society member | — (self-service view only) |

`preview` (templates) renders the template body with sample/merge-field placeholders filled from the
caller-supplied sample data, without sending anything — satisfies "preview messages before sending."

## 10. Role-based authorization

Per the user's literal wording ("Society Administrators" — narrower than `notice.md`'s
`NoticeManagerRoles`), this module uses **`RoleNames.Admin` only** for every configuration and
broadcast-initiating action:
- **Admin**: enable/disable integration, configure provider settings, test connection, manage
  templates, create/send/schedule broadcasts, view history, view recipient-wise status, retry
  failed, cancel pending, view stats.
- **Everyone else** (Chairman, Secretary, Treasurer, Resident, Security): read-only access to
  `GET /api/whatsapp/notifications/mine` — messages sent to their own mobile number, nothing more.
  No visibility into other residents' delivery status, provider config, or templates.
- **SuperAdmin**: no access to any society's WhatsApp settings or messages — consistent with
  SuperAdmin having no operational role inside any specific society elsewhere in this app.

This is flagged in §15 as a deviation from the Notice module's broader `NoticeManagerRoles` — worth
confirming whether Secretary/Chairman should also be able to configure WhatsApp, or whether Admin-
only is intended exactly as literally requested.

## 11. Audit logging

Every mutating call across `WhatsAppProviderConfigService`, `WhatsAppTemplateService`, and
`WhatsAppBroadcastService` (config upsert, enable/disable, template CRUD, broadcast create/cancel/
retry) writes one row via the existing `AuditLogService.LogAsync` into the existing `AuditLog`
table — reusing infrastructure exactly like every other module (§3.7). Individual message sends
(`WhatsAppMessageLog`) are the message-level audit trail; `AuditLog` covers the administrative
actions layer on top.

## 12. Frontend design

- `src/api/whatsapp.js` — thin wrapper: `getConfig()`, `saveConfig(payload)`, `enableIntegration()`,
  `disableIntegration()`, `testConnection()`, `listTemplates()`, `saveTemplate(payload)`,
  `previewTemplate(id, sampleData)`, `createBroadcast(payload)`, `listBroadcasts(params)`,
  `getBroadcast(id)`, `cancelBroadcast(id)`, `retryFailedBroadcast(id)`, `getStats()`,
  `getMyNotifications()`.
- `src/pages/whatsapp/WhatsAppSettings.jsx` (Admin-only, new nav entry `whatsapp-settings` gated
  `roles: ['Admin']`) — provider dropdown (`WhatsAppProviderKeys`), config form (ApiUrl/ApiKey/
  AuthToken/SenderNumber/InstanceId, secrets masked on load), enable/disable toggle, "Test
  Connection" button showing a success/failure banner.
- `src/pages/whatsapp/WhatsAppTemplateList.jsx` + `WhatsAppTemplateForm.jsx` — CRUD + a live preview
  pane rendering `{{placeholder}}` substitution against sample values.
- `src/pages/whatsapp/WhatsAppBroadcastForm.jsx` — trigger-type select (only `Notice` and
  `EmergencyAlert` enabled in Phase 1/4, others disabled with a "coming soon" hint until their
  modules exist, §0), template select, immediate-vs-schedule toggle (`datetime-local` picker when
  scheduling), recipient count preview before send.
- `src/pages/whatsapp/WhatsAppBroadcastHistory.jsx` — list of `WhatsAppBroadcastJob` rows
  (status badge, trigger type, sent/failed counts, scheduled/completed timestamps), row click opens
  `WhatsAppBroadcastDetail.jsx` (recipient-wise table: mobile, status, error, retry count),
  "Retry Failed" (visible only when `FailedCount > 0`) and "Cancel" (visible only while
  `Scheduled`/`Processing`) actions.
- `src/pages/whatsapp/WhatsAppStats.jsx` — simple counts dashboard (sent/delivered/failed, by
  period) — Admin-only.
- `src/components/MyNotifications.jsx` or a section on the existing dashboard home — any role sees
  their own received WhatsApp messages via `getMyNotifications()`.
- `src/config/dashboardNav.js` — new nav entries: `whatsapp-settings`, `whatsapp-templates`,
  `whatsapp-broadcasts` (all `roles: ['Admin']`); no separate nav entry needed for "my
  notifications" if folded into the existing dashboard home.

## 13. Validation rules

- `WhatsAppProviderConfig`: `ProviderKey` required, must be in `WhatsAppProviderKeys.All`. `ApiUrl`
  must be a well-formed absolute URL if provided. At least one of `ApiKey`/`AuthToken` required
  (provider-dependent which).
- `WhatsAppTemplate`: `TemplateKey` + `Name` + `BodyText` required, `BodyText` max 1000 chars
  (WhatsApp's practical message-length ceiling), `TriggerType` must be a valid enum value.
- `CreateBroadcastAsync`: fails with a friendly error if `WhatsAppProviderConfig.IsEnabled == false`
  for the society (same `ServiceResult.Fail` idiom as `MaintenanceBillingService.GenerateAsync`'s
  "already generated" guard) — "WhatsApp integration is not enabled for this society."
  `ScheduledAt`, if provided, must be in the future.
- `RetryFailedAsync`/`CancelAsync`: fail with a friendly error if the job isn't in a state that
  permits the action (e.g. retrying a job with zero `Failed` recipients, cancelling a `Completed`
  job).
- Mobile numbers with a null/blank `Resident.Mobile` are silently excluded from recipient resolution
  (§6), not surfaced as a validation error — this is expected, not exceptional.

## 14. Folder structure

```
Services/WhatsApp/
  Providers/
    IWhatsAppProvider.cs
    WireWebWhatsAppProvider.cs
    IWhatsAppProviderFactory.cs / WhatsAppProviderFactory.cs
  Recipients/
    IWhatsAppRecipientResolver.cs
    NoticeBroadcastRecipientResolver.cs
    EmergencyAlertRecipientResolver.cs
  Repositories/
    IWhatsAppProviderConfigRepository.cs / WhatsAppProviderConfigRepository.cs
    IWhatsAppTemplateRepository.cs / WhatsAppTemplateRepository.cs
    IWhatsAppBroadcastRepository.cs / WhatsAppBroadcastRepository.cs
    IWhatsAppMessageLogRepository.cs / WhatsAppMessageLogRepository.cs
  WhatsAppNotificationService.cs
  WhatsAppBroadcastService.cs
  WhatsAppNoticeBroadcastService.cs
  WhatsAppProviderConfigService.cs
  WhatsAppTemplateService.cs
  WhatsAppBroadcastProcessor.cs
Models/Entities/WhatsApp/
  WhatsAppProviderConfig.cs, WhatsAppTemplate.cs, WhatsAppBroadcastJob.cs,
  WhatsAppBroadcastRecipient.cs, WhatsAppMessageLog.cs, WhatsAppRetryAttempt.cs,
  WhatsAppTriggerType.cs, WhatsAppProviderKeys.cs
Models/Dtos/WhatsApp/
  WhatsAppCreateBroadcastCommand.cs, WhatsAppGetBroadcastQuery.cs, WhatsAppGetHistoryQuery.cs,
  WhatsAppProviderConfigRequest/Response.cs, WhatsAppTemplateRequest/Response.cs,
  WhatsAppBroadcastSummaryResponse.cs, WhatsAppBroadcastDetailResponse.cs
Controllers/
  WhatsAppConfigController.cs, WhatsAppTemplatesController.cs, WhatsAppBroadcastsController.cs,
  WhatsAppNotificationsController.cs (the "mine" endpoint)
```

`Services/WhatsApp/` as a subfolder (rather than flat, like most of this codebase's `Services/`)
follows the one existing precedent for a related-service cluster — `Services/Calculation/` for the
`ICalculationStrategy` implementations.

## 15. Decisions — flagged for confirmation

Mirroring `notice.md` §11's approach: these are genuine deviations or interpretive choices, called
out explicitly rather than silently resolved either direction.

1. **Repository Pattern + CQRS-lite introduced for this module only** (§1, §8) — every other module
   in this codebase injects `SocietyDbContext` directly with no repository layer, and has no
   command/query separation. Built as explicitly requested; confirm this inconsistency with the rest
   of the app is acceptable, or whether it should be scoped back to match house style.
2. **"CQRS" is implemented as command/query DTOs + explicit handler methods, not a MediatR pipeline**
   (§1, §8) — no CQRS library exists in this codebase and none is proposed. Confirm this
   interpretation satisfies the intent, versus wanting an actual mediator library introduced.
3. **No background-job library exists**; a homegrown polling `BackgroundService` (§7.4) is proposed
   for async sending, retries, and scheduling instead of Hangfire/Quartz. Flagged as a future
   enhancement (§17) if scale or multi-instance deployment ever requires a real distributed
   scheduler.
4. **Secrets encrypted via ASP.NET Core's built-in Data Protection API** (§4), not a new
   crypto library — reversible, no new package, per-society purpose-scoped.
5. **`WireWebWhatsAppProvider`'s exact HTTP contract is unconfirmed** (§2.2) — built against the
   generic configured fields with a best-guess wire format; needs verification against WireWeb's
   actual API documentation before Phase 0 is implemented.
6. **Complaints/Events/Visitors/Parking(module) don't exist yet** (§0) — their WhatsApp trigger
   types and recipient resolvers are designed as extensibility points only. They cannot be wired up
   functionally until those modules themselves are built; only Notice broadcasting and a generic
   Emergency Alert trigger are buildable in the phases below.
7. **Admin-only (`RoleNames.Admin`), not `NoticeManagerRoles`** (§10) — per the user's literal
   wording ("Society Administrators"). Confirm whether Secretary/Chairman should also configure
   WhatsApp settings, matching the Notice module's broader manager group, or whether Admin-only is
   intended exactly as stated.
8. **Recipient resolution is trigger-specific** (§6), not one shared "all active members" query —
   flagged since the request's phrasing ("retrieve all active members with valid mobile numbers")
   reads as one universal query, but that would misfire the moment a targeted trigger (Payment
   Reminder) is built.
9. **"Message status" and "scheduling" are modeled as columns, not separate tables** (§3.7) — the
   request lists them alongside provider config/templates/history/jobs/recipients/retries/audit as
   if each needs its own table; this plan reuses the existing `AuditLog` table for audit and folds
   status/scheduling into existing rows rather than creating tables with no independent structure of
   their own.

## 16. Implementation phasing

0. **Phase 0 — Provider abstraction + per-society config + single-message send.**
   `WhatsAppProviderConfig` table/entity, `IWhatsAppProvider`/`WireWebWhatsAppProvider`/factory,
   Data Protection setup (§4), `WhatsAppProviderConfigService`/`Controller`,
   `WhatsAppNotificationService` (single send only, no broadcast yet), `WhatsAppMessageLog` table.
   Frontend: `WhatsAppSettings.jsx` (config form + enable/disable + test connection). Verified:
   Admin configures WireWeb credentials, tests the connection, and a single manual test message
   sends and logs correctly — before any broadcast logic exists.
1. **Phase 1 — Notice broadcast integration (the one real hookup point today, §0).**
   `WhatsAppBroadcastJob`/`WhatsAppBroadcastRecipient` tables, `IWhatsAppRecipientResolver` +
   `NoticeBroadcastRecipientResolver`, `WhatsAppBroadcastService` (create + get + history),
   `WhatsAppNoticeBroadcastService : INoticeBroadcastService`, `WhatsAppBroadcastProcessor`
   (immediate sends only, no scheduling yet), repositories (§8). DI swap:
   `NoOpNoticeBroadcastService` → `WhatsAppNoticeBroadcastService`. Frontend:
   `WhatsAppBroadcastHistory.jsx` + `WhatsAppBroadcastDetail.jsx` (recipient-wise status). Verified:
   publishing a real Notice fans out to every resident with a mobile number, statuses update, a
   deliberately-broken recipient shows `Failed` with an error.
2. **Phase 2 — Templates, retry, cancel, stats.** `WhatsAppTemplate` table/service/CRUD +
   preview, `RetryFailedAsync`/`CancelAsync`, `WhatsAppStats` endpoint. Frontend:
   `WhatsAppTemplateList/Form.jsx`, retry/cancel buttons on history, `WhatsAppStats.jsx`.
3. **Phase 3 — Scheduling & recurrence.** `ScheduledAt` honored by the processor (already designed
   in from Phase 1, just unused until now), `RecurrenceRule` handling (on a recurring job's
   completion, spawn the next occurrence's job row). Frontend: schedule picker in
   `WhatsAppBroadcastForm.jsx`.
4. **Phase 4 (future, gated on other modules existing) — remaining trigger domains.** Generic
   `EmergencyAlertRecipientResolver` (buildable now, since it's just "everyone," could move earlier
   if prioritized). `PaymentReminderRecipientResolver` once an outstanding-bill query exists against
   `MaintenanceBill`/`Payment`. Complaint/Event/Visitor triggers deferred until those modules are
   built — at that point, each is "one new resolver + one new trigger type," per the extensibility
   design (§1), not a rearchitecture.
5. **Phase 5 (future, not built now) — additional providers.** Meta WhatsApp Cloud API,
   Whapi.Cloud, or others as additional `IWhatsAppProvider` implementations, per §1's proven
   extensibility path — zero changes to `WhatsAppNotificationService`, `WhatsAppBroadcastService`, or
   any controller.

Each phase is built, migrated, and verified end-to-end (API + browser) before the next starts, same
discipline as the Maintenance and Notice modules.

## 17. Future enhancement recommendations

- **Real distributed job scheduler** (Hangfire/Quartz) if polling latency (§7.4's 15s interval) or
  multi-instance backend deployment ever becomes a real constraint — the homegrown
  `BackgroundService` doesn't coordinate across multiple app instances.
- **Delivery/read receipts via provider webhooks** — if a provider (Meta Cloud API in particular)
  supports delivery/read status callbacks, add a webhook endpoint that updates
  `WhatsAppMessageLog.Status` beyond "sent," rather than relying only on the synchronous send
  response.
- **Rate-limit-aware throttling per provider** — today's fixed concurrency (§7.4) could be made
  provider-configurable (`ExtraSettingsJson.maxConcurrency`) once real-world provider rate limits are
  known.
- **Bulk/opt-out management** — a resident-facing "opt out of WhatsApp notifications" toggle, if
  ever required for compliance (not requested, but a natural next step for a broadcast system at
  this scale).
- **Message cost tracking** — if a provider bills per message, a running per-society send-count/cost
  dashboard alongside §12's stats page.
