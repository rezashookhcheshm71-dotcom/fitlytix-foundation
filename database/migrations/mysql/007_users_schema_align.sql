-- FitLytix MySQL migration 007: align a pre-existing `users` table with what the app reads.
--
-- Why this exists: migration 002 creates `users` with CREATE TABLE IF NOT EXISTS. If the
-- database already had a `users` table from an earlier version of the product, 002 silently
-- skipped it, so columns the app selects (role, status, first_name, last_name, created_at)
-- were never added. Symptoms: `#1054 Unknown column 'role'`, every account treated as
-- athlete (so /coach/* answers 403), and coach insights silently empty.
--
-- Additive only. Nothing is dropped, renamed, or deleted; existing rows keep their values.
--
-- Two environment facts shaped this file:
--   1. MySQL 8 has no `ADD COLUMN IF NOT EXISTS`, so re-running needs idempotency.
--   2. cPanel/CloudLinux often denies INFORMATION_SCHEMA to the database account
--      (`#1044 Access denied ... to database 'information_schema'`), so the guard cannot ask
--      information_schema whether a column exists.
-- Instead each ALTER runs through a procedure whose CONTINUE HANDLER swallows error 1060
-- (duplicate column) — re-running the file is therefore harmless.
--
-- Run in phpMyAdmin → SQL. Routine names are schema-qualified on purpose: phpMyAdmin's
-- server-level SQL tab has no database selected, and an unqualified DROP/CREATE PROCEDURE
-- fails there with `#1046 No database selected`.

DROP PROCEDURE IF EXISTS eugtezmj_fitlytix.fitlytix_add_column;

DELIMITER $$
CREATE PROCEDURE eugtezmj_fitlytix.fitlytix_add_column(IN p_ddl TEXT)
BEGIN
  DECLARE CONTINUE HANDLER FOR 1060 BEGIN END;
  SET @ddl = p_ddl;
  PREPARE st FROM @ddl;
  EXECUTE st;
  DEALLOCATE PREPARE st;
END$$
DELIMITER ;

CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `password_hash` VARCHAR(255) NULL');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `role` VARCHAR(30) NOT NULL DEFAULT ''athlete''');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `status` VARCHAR(30) NOT NULL DEFAULT ''active''');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `first_name` VARCHAR(100) NOT NULL DEFAULT ''''');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `last_name` VARCHAR(100) NOT NULL DEFAULT ''''');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `phone` VARCHAR(40) NULL');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL eugtezmj_fitlytix.fitlytix_add_column('ALTER TABLE eugtezmj_fitlytix.users ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS eugtezmj_fitlytix.fitlytix_add_column;

-- A scrypt hash is 168 characters (7 + 32 salt + 1 + 128 hex). A legacy VARCHAR(60) column
-- would reject/truncate it, so widen it. Safe to re-run.
ALTER TABLE eugtezmj_fitlytix.users MODIFY COLUMN `password_hash` VARCHAR(255) NULL;

-- Confirmation. `id` must be char(36): an int id would break every session and join.
SHOW COLUMNS FROM eugtezmj_fitlytix.users;
