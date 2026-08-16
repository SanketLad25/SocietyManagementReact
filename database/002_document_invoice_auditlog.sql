-- Adds Document, Invoice, and AuditLog tables to Society Management
-- Run with: sqlcmd -S <server> -E -i database\002_document_invoice_auditlog.sql

USE [Society Management];
GO

CREATE TABLE Document (
    DocumentId INT PRIMARY KEY IDENTITY,
    ResidentId INT NULL,
    FlatId INT NULL,
    DocumentType VARCHAR(50),
    DocumentName NVARCHAR(200),
    FilePath NVARCHAR(500),
    UploadedDate DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (ResidentId) REFERENCES Resident(ResidentId),
    FOREIGN KEY (FlatId) REFERENCES Flat(FlatId)
);
GO

CREATE TABLE Invoice (
    InvoiceId INT PRIMARY KEY IDENTITY,
    InvoiceNo VARCHAR(50),
    VendorName NVARCHAR(150),
    Description NVARCHAR(500),
    Amount DECIMAL(10,2),
    InvoiceDate DATE,
    DueDate DATE,
    Status VARCHAR(20),
    CreatedDate DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE AuditLog (
    AuditLogId INT PRIMARY KEY IDENTITY,
    UserId INT NULL,
    Action VARCHAR(100),
    TableName VARCHAR(100),
    RecordId INT NULL,
    Details NVARCHAR(MAX),
    CreatedDate DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES UserLogin(UserId)
);
GO
