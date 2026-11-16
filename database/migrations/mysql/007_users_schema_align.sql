-- FitLytix MySQL migration 007: align a pre-existing `users` table with what the app reads.
--
-- Why this exists: migration 002 creates `users` with CREATE TABLE IF NOT EXISTS. If the
-- database already had a `users` table from an earlier version of the product, 002 silently
-- skipped it, so columns the app selects (role, status, first_name, last_name, created_at)
-- were never added. Symptoms: `#1054 Unknown column 'role'`, every account treated as
-- athlete (so /coach/* answers 403), and coach insights silently empty.
--
-- Additive only. Nothing is dropped, renamed, or deleted; existing rows keep their values.
-- MySQL 8 has no `ADD COLUMN IF NOT EXISTS`, so each column is added only when missing.
--
-- Run in phpMyAdmin → SQL (it may be the server-level tab; the schema is spelled out).

DROP PROCEDURE IF EXISTS fitlytix_add_column;

DELIMITER $$
CREATE PROCEDURE fitlytix_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'eugtezmj_fitlytix'
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE eugtezmj_fitlytix.', p_table, ' ADD COLUMN `', p_column, '` ', p_ddl);
    PREPARE s FROM @ddl;
    EXECUTE s;
    DEALLOCATE PREPARE s;
  END IF;
END$$
DELIMITER ;

CALL fitlytix_add_column('users', 'password_hash', 'VARCHAR(255) NULL');
CALL fitlytix_add_column('users', 'role', 'VARCHAR(30) NOT NULL DEFAULT ''athlete''');
CALL fitlytix_add_column('users', 'status', 'VARCHAR(30) NOT NULL DEFAULT ''active''');
CALL fitlytix_add_column('users', 'first_name', 'VARCHAR(100) NOT NULL DEFAULT ''''');
CALL fitlytix_add_column('users', 'last_name', 'VARCHAR(100) NOT NULL DEFAULT ''''');
CALL fitlytix_add_column('users', 'phone', 'VARCHAR(40) NULL');
CALL fitlytix_add_column('users', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL fitlytix_add_column('users', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS fitlytix_add_column;

-- A scrypt hash is 168 characters (7 + 32 salt + 1 + 128 hex). A legacy VARCHAR(60) column
-- would truncate it, so widen it. Safe to re-run.
ALTER TABLE eugtezmj_fitlytix.users MODIFY COLUMN `password_hash` VARCHAR(255) NULL;

-- Confirmation: these rows should show role/status/first_name/last_name/created_at, and
-- `id` must be CHAR(36) — an INT id would break every session and join.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'eugtezmj_fitlytix' AND TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;
