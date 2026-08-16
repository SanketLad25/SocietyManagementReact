-- User Password Management & User Administration module.
-- Adds a login-level active flag and a forced-password-change flag to UserLogin. IsActive here is
-- deliberately independent of Resident.IsActive (which already exists and is managed by the
-- Residents module) rather than kept in sync with it — two separate concerns owned by two separate
-- modules; AuthService.LoginAsync checks both, but nothing writes to Resident.IsActive from here.
USE [Society Management];
GO

SET QUOTED_IDENTIFIER ON;
GO

ALTER TABLE UserLogin ADD IsActive BIT NOT NULL CONSTRAINT DF_UserLogin_IsActive DEFAULT (1);
GO

ALTER TABLE UserLogin ADD MustChangePassword BIT NOT NULL CONSTRAINT DF_UserLogin_MustChangePassword DEFAULT (0);
GO
