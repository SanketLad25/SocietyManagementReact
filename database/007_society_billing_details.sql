-- Adds registration, bank, and payment-contact details to Society so the maintenance bill can be
-- rendered as a real printed-style invoice (letterhead + bank/cheque instructions), matching the
-- format of societies' existing paper bills. SuperAdmin-only fields, editable via the Society
-- create/edit form.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

ALTER TABLE Society ADD RegistrationNo NVARCHAR(50) NULL;
ALTER TABLE Society ADD BankName NVARCHAR(100) NULL;
ALTER TABLE Society ADD BankAccountNumber NVARCHAR(30) NULL;
ALTER TABLE Society ADD BankIfsc NVARCHAR(20) NULL;
ALTER TABLE Society ADD ChequePayeeName NVARCHAR(150) NULL;
ALTER TABLE Society ADD ContactNumber NVARCHAR(20) NULL;
ALTER TABLE Society ADD InterestOnArrearsPercent DECIMAL(5, 2) NULL;
GO
