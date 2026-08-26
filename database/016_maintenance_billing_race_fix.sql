-- Defensive backstop against MaintenanceBillingService.GenerateAsync double-billing a flat —
-- the primary fix is an atomic conditional status flip (Draft -> Generating) in the service
-- itself, but this unique index is the second line of defense: even if two concurrent generate
-- calls somehow both got past the status check, the second flat-bill insert for the same
-- (CycleId, FlatId) now fails at the database level instead of silently succeeding twice.
-- Filtered (WHERE FlatId IS NOT NULL): MaintenanceBill.FlatId is nullable in the schema even
-- though GenerateAsync always sets it — SQL Server allows only one NULL in a plain unique index,
-- so an unfiltered index would break the moment a second NULL-FlatId row (from any future code
-- path) landed in the same cycle.
SET QUOTED_IDENTIFIER ON;
GO
CREATE UNIQUE INDEX UX_MaintenanceBill_CycleId_FlatId ON MaintenanceBill(CycleId, FlatId) WHERE FlatId IS NOT NULL;
GO
