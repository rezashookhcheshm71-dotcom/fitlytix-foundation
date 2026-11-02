-- FitLytix MySQL migration 003: stop the schema from fabricating athlete identity
-- Additive only: widens columns and removes invented defaults. Never drops a
-- table or column, never renames one, never truncates, deletes or rewrites a
-- single existing row.
--
-- WHY
-- Migration 002 created athlete_profiles with:
--     primary_sport_slug VARCHAR(50) NOT NULL DEFAULT 'crossfit'
--     experience_level   VARCHAR(30) NOT NULL DEFAULT 'beginner'
--     coaching_type      VARCHAR(30) NOT NULL DEFAULT 'hybrid'
--
-- Those defaults manufacture an athlete identity the user never supplied. Any
-- INSERT that omits the column silently records a CrossFit beginner on hybrid
-- coaching, and every downstream analysis, score and proposal is then built on
-- that invention. This violates the project's first law: reality over score,
-- never invent a value, and an absent measurement must be visibly absent.
--
-- Fixing only the application code would have been cosmetic - the column itself
-- would keep supplying 'crossfit' whenever the caller passed nothing.
--
-- WHAT CHANGES
-- Each column becomes NULLable with no default, so "the user did not choose" is
-- representable as NULL instead of being disguised as a choice. NULL is itself
-- the provenance signal, which is why no extra marker column is added.
--
-- MODIFY COLUMN is naturally idempotent: running this twice yields the same
-- definition. It widens the column (NOT NULL -> NULL) so it cannot reject a
-- value that was previously acceptable.
--
-- HONEST LIMITATION, deliberately not papered over
-- Rows already written keep their 'crossfit' / 'beginner' / 'hybrid' values.
-- There is no way to distinguish a fabricated default from a genuine user choice
-- in the existing data, so this migration does not attempt to. Nothing is
-- rewritten and no row is marked. After this migration only NEW rows can carry
-- NULL, so the population of NULL-able rows grows from here and the fabricated
-- ones remain identifiable only by having been created before this point.
-- Deciding whether to clear them is a separate, explicit judgement call that
-- should not be smuggled into a schema change.

ALTER TABLE athlete_profiles
  MODIFY COLUMN primary_sport_slug VARCHAR(50) NULL;

ALTER TABLE athlete_profiles
  MODIFY COLUMN experience_level VARCHAR(30) NULL;

ALTER TABLE athlete_profiles
  MODIFY COLUMN coaching_type VARCHAR(30) NULL;

INSERT INTO schema_migrations (version, notes)
VALUES ('003_remove_fabricated_profile_defaults', 'athlete_profiles: primary_sport_slug, experience_level and coaching_type become NULLable with no default, so an unchosen identity is stored as absent rather than fabricated. No existing row is modified.')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
