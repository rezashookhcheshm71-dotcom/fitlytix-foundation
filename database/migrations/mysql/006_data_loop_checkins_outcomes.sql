-- 006 — Close the loop: manual check-ins and outcome labels.
--
-- Why:
--   * the model's behavioural inputs (sleep, stress, readiness, adherence, RPE) were the
--     thinnest part of a real plan — a brand-new athlete had none of them, so every plan
--     fell back to the fill values baked into the model;
--   * `recommendation_outcomes` existed but had nothing to point at, so real data could
--     never be used for retraining.
--
-- This migration is additive. Both statements are safe to re-run except the ALTER, which
-- fails with error 1060 ("duplicate column") once applied — that error can be ignored.

CREATE TABLE IF NOT EXISTS athlete_checkins (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  checkin_date DATE NOT NULL,
  sleep_hours DECIMAL(4,2) NULL,
  sleep_quality TINYINT UNSIGNED NULL,
  stress TINYINT UNSIGNED NULL,
  readiness TINYINT UNSIGNED NULL,
  weight_kg DECIMAL(5,2) NULL,
  resting_hr SMALLINT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'manual',
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checkin_user_date (athlete_user_id, checkin_date),
  KEY idx_checkin_user_date (athlete_user_id, checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- No FOREIGN KEY on purpose: `users.id` differs between installs (same reason as 004).

ALTER TABLE recommendation_outcomes
  ADD COLUMN snapshot_id CHAR(36) NULL,
  ADD COLUMN window_days SMALLINT UNSIGNED NULL,
  ADD COLUMN nutrition_adherence DECIMAL(4,3) NULL,
  ADD COLUMN avg_rpe DECIMAL(4,1) NULL,
  ADD COLUMN label_source VARCHAR(24) NOT NULL DEFAULT 'auto',
  ADD UNIQUE KEY uq_outcome_snapshot (snapshot_id);
