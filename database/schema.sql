-- Society Management database schema
-- Run with: sqlcmd -S <server> -E -i database\schema.sql

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'Society Management')
BEGIN
    CREATE DATABASE [Society Management];
END
GO

USE [Society Management];
GO

CREATE TABLE Society (
    SocietyId INT PRIMARY KEY IDENTITY,
    SocietyName NVARCHAR(100),
    Address NVARCHAR(250),
    City NVARCHAR(50),
    State NVARCHAR(50),
    PinCode NVARCHAR(10),
    CreatedDate DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE Wing (
    WingId INT PRIMARY KEY IDENTITY,
    SocietyId INT,
    WingName VARCHAR(20),
    FOREIGN KEY (SocietyId) REFERENCES Society(SocietyId)
);
GO

CREATE TABLE Flat (
    FlatId INT PRIMARY KEY IDENTITY,
    WingId INT,
    FlatNo VARCHAR(20),
    FloorNo INT,
    AreaSqFt DECIMAL(10,2),
    MaintenanceAmount DECIMAL(10,2),
    FOREIGN KEY (WingId) REFERENCES Wing(WingId)
);
GO

CREATE TABLE Resident (
    ResidentId INT PRIMARY KEY IDENTITY,
    FlatId INT,
    FullName NVARCHAR(100),
    Mobile VARCHAR(15),
    Email NVARCHAR(100),
    PasswordHash NVARCHAR(500),
    IsOwner BIT,
    IsActive BIT,
    FOREIGN KEY (FlatId) REFERENCES Flat(FlatId)
);
GO

CREATE TABLE MaintenanceBill (
    BillId INT PRIMARY KEY IDENTITY,
    FlatId INT,
    BillMonth INT,
    BillYear INT,
    Amount DECIMAL(10,2),
    DueDate DATE,
    Status VARCHAR(20),
    CreatedDate DATETIME,
    FOREIGN KEY (FlatId) REFERENCES Flat(FlatId)
);
GO

CREATE TABLE Payment (
    PaymentId INT PRIMARY KEY IDENTITY,
    BillId INT,
    AmountPaid DECIMAL(10,2),
    PaymentDate DATETIME,
    PaymentMode VARCHAR(50),
    TransactionId VARCHAR(100),
    Status VARCHAR(20),
    FOREIGN KEY (BillId) REFERENCES MaintenanceBill(BillId)
);
GO

CREATE TABLE Complaint (
    ComplaintId INT PRIMARY KEY IDENTITY,
    ResidentId INT,
    Subject NVARCHAR(200),
    Description NVARCHAR(MAX),
    Status VARCHAR(30),
    Priority VARCHAR(20),
    CreatedDate DATETIME,
    ClosedDate DATETIME NULL,
    FOREIGN KEY (ResidentId) REFERENCES Resident(ResidentId)
);
GO

CREATE TABLE Notice (
    NoticeId INT PRIMARY KEY IDENTITY,
    Title NVARCHAR(200),
    Description NVARCHAR(MAX),
    PublishDate DATETIME,
    ExpiryDate DATETIME,
    CreatedBy INT
);
GO

CREATE TABLE Visitor (
    VisitorId INT PRIMARY KEY IDENTITY,
    ResidentId INT,
    VisitorName NVARCHAR(100),
    Mobile VARCHAR(15),
    VehicleNo VARCHAR(20),
    EntryTime DATETIME,
    ExitTime DATETIME NULL,
    Status VARCHAR(20),
    FOREIGN KEY (ResidentId) REFERENCES Resident(ResidentId)
);
GO

CREATE TABLE SecurityGuard (
    GuardId INT PRIMARY KEY IDENTITY,
    GuardName NVARCHAR(100),
    Mobile VARCHAR(15),
    ShiftName VARCHAR(20)
);
GO

CREATE TABLE VisitorEntry (
    EntryId INT PRIMARY KEY IDENTITY,
    VisitorId INT,
    GuardId INT,
    EntryDate DATETIME,
    FOREIGN KEY (VisitorId) REFERENCES Visitor(VisitorId),
    FOREIGN KEY (GuardId) REFERENCES SecurityGuard(GuardId)
);
GO

CREATE TABLE Parking (
    ParkingId INT PRIMARY KEY IDENTITY,
    FlatId INT,
    ParkingNo VARCHAR(20),
    VehicleNo VARCHAR(20),
    VehicleType VARCHAR(20),
    FOREIGN KEY (FlatId) REFERENCES Flat(FlatId)
);
GO

CREATE TABLE Staff (
    StaffId INT PRIMARY KEY IDENTITY,
    StaffName NVARCHAR(100),
    Designation VARCHAR(50),
    Mobile VARCHAR(15)
);
GO

CREATE TABLE Event (
    EventId INT PRIMARY KEY IDENTITY,
    EventName NVARCHAR(100),
    EventDate DATETIME,
    Description NVARCHAR(MAX)
);
GO

CREATE TABLE Role (
    RoleId INT PRIMARY KEY IDENTITY,
    RoleName VARCHAR(30)
);
GO

CREATE TABLE UserLogin (
    UserId INT PRIMARY KEY IDENTITY,
    ResidentId INT,
    Username VARCHAR(50),
    PasswordHash NVARCHAR(500),
    RoleId INT,
    FOREIGN KEY (ResidentId) REFERENCES Resident(ResidentId),
    FOREIGN KEY (RoleId) REFERENCES Role(RoleId)
);
GO
