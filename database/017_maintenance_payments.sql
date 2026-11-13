-- Payment & Receipt recording (maintenance billing Phase 4). Confirmed design decisions:
-- (1) Payment and Receipt are ONE combined record — no separate Receipt table. A Payment row IS
--     the receipt; ReceiptNo is stamped at insert time (no payment gateway — a committee member
--     manually recording a payment is the confirmation).
-- (2) Partial payments are supported. MaintenanceBill.Status is a pre-existing free-text
--     NVARCHAR(20)/VARCHAR(20) column that already accepts any string — no ALTER needed there,
--     it now also accepts the value 'Partially Paid' alongside the existing 'Unpaid'/'Paid'
--     (enforced/derived in code by PaymentService.RecomputeBillStatusAsync, not by a DB CHECK).
--
-- Payment ALREADY EXISTS from the original schema.sql (PaymentId, BillId, AmountPaid, PaymentDate,
-- PaymentMode, TransactionId, Status — 0 rows, verified via `SELECT COUNT(*) FROM Payment` before
-- writing this file) and already picked up SocietyId (NOT NULL, FK'd to Society) plus the standard
-- IAuditable columns (CreatedOn NOT NULL DEFAULT GETDATE(), CreatedBy, ModifiedOn, ModifiedBy, all
-- FK'd to UserLogin) back in 003_multi_tenant_audit.sql §8 — this migration does NOT re-add those,
-- only the columns/constraints genuinely new to real payment-recording. Same "ALTER in place, table
-- already exists" situation 010_complaints.sql handled for Complaint.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

-- Table has 0 rows — safe to tighten NOT NULL / change types in place without a backfill pass.
ALTER TABLE Payment ALTER COLUMN BillId INT NOT NULL;
GO

CREATE INDEX IX_Payment_BillId ON Payment(BillId);
GO

ALTER TABLE Payment ALTER COLUMN AmountPaid DECIMAL(10,2) NOT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT CK_Payment_AmountPaid CHECK (AmountPaid > 0);
GO

ALTER TABLE Payment ALTER COLUMN PaymentDate DATETIME NOT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT DF_Payment_PaymentDate DEFAULT (GETDATE()) FOR PaymentDate;
GO

-- Free-text, validated against a known set (Cash/Cheque/UPI/NEFT/Card) in PaymentService, not a
-- DB CHECK — matches the accounts-management skill §4 guidance for PaymentMode.
ALTER TABLE Payment ALTER COLUMN PaymentMode NVARCHAR(20) NOT NULL;
GO

ALTER TABLE Payment ALTER COLUMN Status NVARCHAR(20) NOT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT DF_Payment_Status DEFAULT ('Confirmed') FOR Status;
GO

-- The receipt number. One Payment row IS the receipt (confirmed decision #1) — unique per society
-- per the accounts-management skill §1's "give every transaction row its own human-referenceable
-- number" rule. Format: RCPT-{year}-{6-digit sequence}, generated in PaymentService.RecordPaymentAsync.
ALTER TABLE Payment ADD ReceiptNo NVARCHAR(30) NOT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT UX_Payment_Society_ReceiptNo UNIQUE (SocietyId, ReceiptNo);
GO

-- Never hard-delete a payment (accounts-management skill §1/§3) — only cancel-with-required-reason,
-- keeping the original row intact and visible in history.
ALTER TABLE Payment ADD CancelledReason NVARCHAR(300) NULL;
GO
ALTER TABLE Payment ADD CancelledOn DATETIME NULL;
GO
ALTER TABLE Payment ADD CancelledBy INT NULL;
GO
ALTER TABLE Payment ADD CONSTRAINT FK_Payment_CancelledBy FOREIGN KEY (CancelledBy) REFERENCES UserLogin(UserId);
GO

ALTER TABLE Payment ADD Notes NVARCHAR(300) NULL;
GO
