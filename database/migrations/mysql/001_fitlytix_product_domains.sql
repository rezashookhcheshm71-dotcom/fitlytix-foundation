-- FitLytix MySQL migration 001: persistent product domains
-- Additive only: creates new tables; does not drop or rewrite existing data.
-- Run only after taking a database backup. Requires MySQL/MariaDB with JSON support.
-- Existing IDs are CHAR(36); application generates UUIDs.
-- Demo records must use data_origin='demo'; production records default to 'live'.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS training_programs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  coach_user_id CHAR(36) NULL,
  sport_id CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'coach',
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  goal_snapshot JSON NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  version_no INT NOT NULL DEFAULT 1,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_training_programs_athlete_status (athlete_user_id, status, updated_at),
  KEY idx_training_programs_coach_status (coach_user_id, status),
  KEY idx_training_programs_sport (sport_id),
  CONSTRAINT fk_training_programs_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_training_programs_coach FOREIGN KEY (coach_user_id) REFERENCES users(id),
  CONSTRAINT fk_training_programs_sport FOREIGN KEY (sport_id) REFERENCES sports(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS training_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  program_id CHAR(36) NOT NULL,
  athlete_user_id CHAR(36) NOT NULL,
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  title VARCHAR(180) NOT NULL,
  session_type VARCHAR(50) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  prescription JSON NULL,
  coach_notes TEXT NULL,
  athlete_notes TEXT NULL,
  perceived_exertion DECIMAL(4,1) NULL,
  duration_seconds INT NULL,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_training_sessions_athlete_schedule (athlete_user_id, scheduled_at),
  KEY idx_training_sessions_program (program_id, scheduled_at),
  CONSTRAINT fk_training_sessions_program FOREIGN KEY (program_id) REFERENCES training_programs(id),
  CONSTRAINT fk_training_sessions_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workout_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  block_type VARCHAR(40) NOT NULL DEFAULT 'exercise',
  exercise_name VARCHAR(180) NOT NULL,
  prescription JSON NULL,
  coaching_cues TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_workout_items_session_order (session_id, sort_order),
  CONSTRAINT fk_workout_items_session FOREIGN KEY (session_id) REFERENCES training_sessions(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workout_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  workout_item_id CHAR(36) NULL,
  performed_at DATETIME NOT NULL,
  result_value DECIMAL(12,3) NULL,
  result_unit VARCHAR(30) NULL,
  sets_json JSON NULL,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_workout_logs_athlete_date (athlete_user_id, performed_at),
  KEY idx_workout_logs_session (session_id),
  CONSTRAINT fk_workout_logs_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_workout_logs_session FOREIGN KEY (session_id) REFERENCES training_sessions(id),
  CONSTRAINT fk_workout_logs_item FOREIGN KEY (workout_item_id) REFERENCES workout_items(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workout_feedback (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  energy_score TINYINT NULL,
  difficulty_score TINYINT NULL,
  pain_reported BOOLEAN NOT NULL DEFAULT FALSE,
  pain_notes TEXT NULL,
  mood VARCHAR(40) NULL,
  feedback_text TEXT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_workout_feedback_athlete_date (athlete_user_id, submitted_at),
  KEY idx_workout_feedback_session (session_id),
  CONSTRAINT fk_workout_feedback_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_workout_feedback_session FOREIGN KEY (session_id) REFERENCES training_sessions(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nutrition_plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  coach_user_id CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  target_calories INT NULL,
  protein_g DECIMAL(8,2) NULL,
  carbs_g DECIMAL(8,2) NULL,
  fat_g DECIMAL(8,2) NULL,
  plan_json JSON NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'coach',
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_nutrition_plans_athlete_status (athlete_user_id, status, updated_at),
  CONSTRAINT fk_nutrition_plans_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_nutrition_plans_coach FOREIGN KEY (coach_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NULL,
  logged_at DATETIME NOT NULL,
  meal_type VARCHAR(40) NULL,
  description VARCHAR(255) NOT NULL,
  calories INT NULL,
  protein_g DECIMAL(8,2) NULL,
  carbs_g DECIMAL(8,2) NULL,
  fat_g DECIMAL(8,2) NULL,
  quantity_json JSON NULL,
  adherence_score TINYINT NULL,
  notes TEXT NULL,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_nutrition_logs_athlete_date (athlete_user_id, logged_at),
  KEY idx_nutrition_logs_plan (plan_id),
  CONSTRAINT fk_nutrition_logs_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_nutrition_logs_plan FOREIGN KEY (plan_id) REFERENCES nutrition_plans(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_coaching_runs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  sport_id CHAR(36) NULL,
  run_type VARCHAR(50) NOT NULL,
  provider VARCHAR(80) NOT NULL DEFAULT 'rule_engine',
  model_name VARCHAR(120) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  input_snapshot JSON NULL,
  output_payload JSON NULL,
  decision_summary TEXT NULL,
  accepted_at DATETIME NULL,
  rejected_at DATETIME NULL,
  linked_program_id CHAR(36) NULL,
  error_code VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  KEY idx_ai_runs_athlete_date (athlete_user_id, created_at),
  KEY idx_ai_runs_status (status, created_at),
  CONSTRAINT fk_ai_runs_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_ai_runs_sport FOREIGN KEY (sport_id) REFERENCES sports(id),
  CONSTRAINT fk_ai_runs_program FOREIGN KEY (linked_program_id) REFERENCES training_programs(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  plan_code VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  billing_interval VARCHAR(30) NOT NULL,
  interval_count INT NOT NULL DEFAULT 1,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  features JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subscription_plans_code (plan_code),
  KEY idx_subscription_plans_active (is_active, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  starts_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at DATETIME NULL,
  provider VARCHAR(60) NULL,
  provider_customer_id VARCHAR(190) NULL,
  provider_subscription_id VARCHAR(190) NULL,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_subscriptions_user_status (user_id, status),
  KEY idx_subscriptions_period_end (status, current_period_end),
  UNIQUE KEY uq_subscriptions_provider_ref (provider, provider_subscription_id),
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  subscription_id CHAR(36) NULL,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  provider VARCHAR(60) NOT NULL,
  provider_payment_id VARCHAR(190) NULL,
  idempotency_key VARCHAR(190) NOT NULL,
  checkout_url TEXT NULL,
  failure_code VARCHAR(100) NULL,
  failure_message TEXT NULL,
  paid_at DATETIME NULL,
  refunded_at DATETIME NULL,
  metadata JSON NULL,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_idempotency (idempotency_key),
  UNIQUE KEY uq_payment_provider_ref (provider, provider_payment_id),
  KEY idx_payments_user_date (user_id, created_at),
  KEY idx_payments_subscription (subscription_id, status),
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_payments_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(60) NOT NULL,
  provider_event_id VARCHAR(190) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  processing_status VARCHAR(30) NOT NULL DEFAULT 'received',
  payload JSON NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  error_message TEXT NULL,
  UNIQUE KEY uq_payment_webhook_provider_event (provider, provider_event_id),
  KEY idx_payment_webhook_status (processing_status, received_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wearable_connections (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  external_user_id VARCHAR(190) NULL,
  scopes_json JSON NULL,
  connected_at DATETIME NULL,
  last_sync_at DATETIME NULL,
  last_error TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wearable_athlete_provider (athlete_user_id, provider),
  KEY idx_wearable_status_sync (status, last_sync_at),
  CONSTRAINT fk_wearable_connections_athlete FOREIGN KEY (athlete_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wearable_sync_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  records_received INT NOT NULL DEFAULT 0,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  metadata JSON NULL,
  KEY idx_wearable_sync_connection_date (connection_id, started_at),
  CONSTRAINT fk_wearable_sync_connection FOREIGN KEY (connection_id) REFERENCES wearable_connections(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36) NULL,
  request_id VARCHAR(100) NULL,
  ip_hash CHAR(64) NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_actor_date (actor_user_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id, created_at),
  KEY idx_audit_action_date (action, created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

INSERT INTO schema_migrations (version, notes)
VALUES ('001_fitlytix_product_domains', 'Additive core tables for training, nutrition, AI, subscriptions/payments, wearables and audit')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
