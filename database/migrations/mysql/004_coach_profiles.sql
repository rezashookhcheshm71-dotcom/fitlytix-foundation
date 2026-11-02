-- FitLytix MySQL migration 004: coach_profiles (P39)
-- Additive only: creates one new table. Drops nothing, renames nothing,
-- truncates nothing, and alters no existing table or row.
--
-- WHY
-- UserRole declares four roles (athlete, coach, head_coach, admin) and ten
-- coach screens exist in src/routes/coach.*.tsx, roughly 61 KB of real UI. But
-- registration hardcoded role = 'athlete', no coach registration path existed,
-- and no table held coach-specific data. src/services/coach/service.ts carries a
-- TODO(backend) naming exactly these tables. So the entire coach surface was
-- unreachable: four roles declared, one reachable.
--
-- This table is what makes a coach able to exist. It is deliberately minimal -
-- only what is required for a coach to be created, identified and reached.
--
-- WHAT IS DELIBERATELY ABSENT
-- No commercial columns (revenue share, payout terms, pricing tiers). The
-- business documents propose a share model but nothing establishes it yet, and
-- inventing schema for an undecided policy is the same error as inventing a
-- value. Those columns belong in a later migration once the terms are ratified.
--
-- No vetting gate. `status` defaults to 'active', mirroring the existing
-- users.status convention, because whether coaches require approval before
-- appearing to athletes is a business decision that has not been made. Encoding
-- 'pending_review' here would silently enact a policy nobody chose.
--
-- NULLability follows migration 003: identity attributes are NULL when unknown
-- rather than defaulted, so absence stays visible.

CREATE TABLE IF NOT EXISTS coach_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,

  -- Sport the coach primarily coaches. NULL means not yet supplied; migration
  -- 003 established that an unchosen sport must not be fabricated.
  primary_sport_slug VARCHAR(50) NULL,

  -- Optional coaching credentials. Both NULLable: many legitimate coaches have
  -- no formal licence, and an empty string would be indistinguishable from a
  -- real-but-blank value.
  licence_number VARCHAR(100) NULL,
  biography TEXT NULL,

  -- Operational state, mirroring users.status. Not a vetting judgement.
  status VARCHAR(30) NOT NULL DEFAULT 'active',

  -- Convention from database/migrations/README.md: demo rows are marked here
  -- rather than by inserting well-known demo ids.
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_coach_profiles_user (user_id),
  KEY idx_coach_profiles_sport (primary_sport_slug),
  KEY idx_coach_profiles_status (status),
  CONSTRAINT fk_coach_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

INSERT INTO schema_migrations (version, notes)
VALUES ('004_coach_profiles', 'Additive: creates coach_profiles so a coach can exist and be reached. No commercial columns and no vetting gate, because neither policy is established. Existing tables and rows untouched.')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
