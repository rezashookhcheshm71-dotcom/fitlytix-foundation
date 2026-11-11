-- FitLytix MySQL migration 003: recommendation engine audit + feedback loop
-- Additive only: CREATE TABLE IF NOT EXISTS. No drops, no destructive updates.
--
-- Why these tables exist:
--   recommendation_events   every decision the self-hosted model made (context + action)
--   recommendation_outcomes the reward signal once a cycle ends (did it work?)
--   model_registry          which model version is live, with its evaluation report
--
-- Together they let you retrain on real data instead of the synthetic simulator:
--   features = input_json / athlete history, action = chosen programme + duration,
--   reward = completed_cycle, adherence, progress_score.

CREATE TABLE IF NOT EXISTS recommendation_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_id CHAR(36) NULL,
  sport VARCHAR(40) NOT NULL,
  model_version VARCHAR(60) NOT NULL,
  model_source VARCHAR(20) NOT NULL DEFAULT 'model',
  program_archetype VARCHAR(60) NOT NULL,
  nutrition_strategy VARCHAR(40) NOT NULL,
  duration_months TINYINT UNSIGNED NOT NULL,
  coaching_mode VARCHAR(20) NOT NULL,
  safety_level VARCHAR(20) NOT NULL DEFAULT 'none',
  confidence VARCHAR(10) NOT NULL DEFAULT 'medium',
  adherence_cycle DECIMAL(4,3) NULL,
  input_json JSON NOT NULL,
  output_json JSON NOT NULL,
  latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reco_events_athlete (athlete_id, created_at),
  KEY idx_reco_events_sport (sport, created_at),
  KEY idx_reco_events_model (model_version),
  KEY idx_reco_events_archetype (program_archetype, duration_months)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  athlete_id CHAR(36) NOT NULL,
  completed_cycle BOOLEAN NOT NULL DEFAULT FALSE,
  adherence DECIMAL(4,3) NULL,
  sessions_completed SMALLINT UNSIGNED NULL,
  progress_score DECIMAL(5,2) NULL,
  note VARCHAR(500) NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reco_outcomes_event (event_id),
  KEY idx_reco_outcomes_athlete (athlete_id, recorded_at),
  CONSTRAINT fk_reco_outcomes_event FOREIGN KEY (event_id) REFERENCES recommendation_events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS model_registry (
  id CHAR(36) NOT NULL PRIMARY KEY,
  model_version VARCHAR(60) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'plan_recommender',
  schema_version SMALLINT UNSIGNED NOT NULL,
  artifact_sha256 CHAR(64) NOT NULL,
  trained_at DATETIME NOT NULL,
  metrics_json JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_model_registry_version (model_version),
  KEY idx_model_registry_active (kind, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
