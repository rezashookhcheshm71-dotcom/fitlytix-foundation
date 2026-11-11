-- 004 — Snapshot of every plan the recommendation engine produced for an athlete.
--
-- Why a dedicated table (instead of only recommendation_events from 003):
--   * the athlete UI must be able to re-open *the exact plan it showed* days later,
--     even after the model artefact changed;
--   * support/coach needs the inputs that produced a plan, not just its outputs;
--   * retraining needs a time-ordered history of (inputs → action → later outcome).
--
-- Additive and non-destructive: safe to run on an existing database.

CREATE TABLE IF NOT EXISTS recommendation_snapshots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  sport VARCHAR(30) NOT NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'assessment',
  model_version VARCHAR(64) NOT NULL,
  model_schema_version INT NOT NULL DEFAULT 1,
  model_training_data VARCHAR(32) NOT NULL DEFAULT 'simulated',
  archetype_id VARCHAR(64) NOT NULL,
  nutrition_strategy_id VARCHAR(64) NOT NULL,
  duration_months TINYINT UNSIGNED NOT NULL,
  coaching_mode VARCHAR(20) NOT NULL,
  package_id VARCHAR(20) NOT NULL,
  safety_level VARCHAR(20) NOT NULL DEFAULT 'none',
  confidence VARCHAR(10) NOT NULL DEFAULT 'low',
  adherence_30d DECIMAL(4,3) NOT NULL DEFAULT 0,
  adherence_cycle DECIMAL(4,3) NOT NULL DEFAULT 0,
  data_completeness DECIMAL(4,3) NOT NULL DEFAULT 0,
  input_hash CHAR(64) NOT NULL,
  request_json JSON NOT NULL,
  result_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_snapshot_input (user_id, input_hash, model_version),
  KEY idx_snapshot_user_created (user_id, created_at),
  KEY idx_snapshot_user_sport (user_id, sport, created_at),
  CONSTRAINT fk_snapshot_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Latest plan per athlete without scanning history.
CREATE OR REPLACE VIEW v_latest_recommendation AS
SELECT s.*
FROM recommendation_snapshots s
JOIN (
  SELECT user_id, MAX(created_at) AS created_at
  FROM recommendation_snapshots
  GROUP BY user_id
) latest ON latest.user_id = s.user_id AND latest.created_at = s.created_at;
