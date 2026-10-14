-- FitLytix MySQL migration 002: core auth, sessions, sports, assessments, body analysis & health metrics
-- Additive only: uses CREATE TABLE IF NOT EXISTS and non-destructive upserts.
-- Never drops, truncates, or deletes existing production tables or records.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  role VARCHAR(30) NOT NULL DEFAULT 'athlete',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_phone (phone),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  KEY idx_user_sessions_user_expires (user_id, expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_fa VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sports_slug (slug)
) ENGINE=InnoDB;

-- Seed the 5 supported FitLytix sports safely without overwriting existing rows
INSERT INTO sports (id, slug, name, name_fa, is_active, sort_order)
VALUES
  ('11111111-1111-4111-8111-000000000001', 'crossfit', 'CrossFit', 'کراس‌فیت', TRUE, 1),
  ('11111111-1111-4111-8111-000000000002', 'hyrox', 'Hyrox', 'هایراکس', TRUE, 2),
  ('11111111-1111-4111-8111-000000000003', 'functional', 'Functional Training', 'تمرین فانکشنال', TRUE, 3),
  ('11111111-1111-4111-8111-000000000004', 'bodybuilding', 'Bodybuilding', 'بدنسازی', TRUE, 4),
  ('11111111-1111-4111-8111-000000000005', 'running', 'Running', 'دویدن', TRUE, 5)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  name_fa = VALUES(name_fa),
  is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS athlete_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  primary_sport_id CHAR(36) NULL,
  primary_sport_slug VARCHAR(50) NOT NULL DEFAULT 'crossfit',
  experience_level VARCHAR(30) NOT NULL DEFAULT 'beginner',
  coaching_type VARCHAR(30) NOT NULL DEFAULT 'hybrid',
  gender VARCHAR(20) NULL,
  birth_year INT NULL,
  age INT NULL,
  height_cm DECIMAL(5,2) NULL,
  weight_kg DECIMAL(5,2) NULL,
  training_history VARCHAR(100) NULL,
  wearable_intent VARCHAR(30) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_athlete_profiles_user (user_id),
  KEY idx_athlete_profiles_sport (primary_sport_id),
  CONSTRAINT fk_athlete_profiles_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_athlete_profiles_sport FOREIGN KEY (primary_sport_id) REFERENCES sports(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  athlete_id CHAR(36) NULL,
  sport_id CHAR(36) NULL,
  sport_slug VARCHAR(50) NULL,
  template_id VARCHAR(100) NOT NULL,
  template_version INT NOT NULL DEFAULT 2,
  scope VARCHAR(50) NOT NULL DEFAULT 'common',
  experience_level VARCHAR(30) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  completion_ratio DECIMAL(5,4) NOT NULL DEFAULT 0,
  answers_json JSON NOT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_assessments_athlete_scope (athlete_user_id, scope, created_at),
  KEY idx_assessments_template (template_id, created_at),
  KEY idx_assessments_sport (sport_id),
  CONSTRAINT fk_assessments_athlete_user FOREIGN KEY (athlete_user_id) REFERENCES users(id),
  CONSTRAINT fk_assessments_sport FOREIGN KEY (sport_id) REFERENCES sports(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_answers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  assessment_id CHAR(36) NOT NULL,
  field_id VARCHAR(120) NOT NULL,
  value_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_field (assessment_id, field_id),
  CONSTRAINT fk_assessment_answers_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS body_analysis_records (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  measured_at DATE NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'inbody',
  weight_kg DECIMAL(5,2) NULL,
  body_fat_pct DECIMAL(5,2) NULL,
  skeletal_muscle_kg DECIMAL(5,2) NULL,
  data_json JSON NOT NULL,
  notes TEXT NULL,
  data_origin VARCHAR(20) NOT NULL DEFAULT 'live',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_body_analysis_athlete_date (athlete_user_id, measured_at),
  CONSTRAINT fk_body_analysis_athlete_user FOREIGN KEY (athlete_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS health_metrics (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_user_id CHAR(36) NOT NULL,
  source VARCHAR(50) NOT NULL,
  connection_id CHAR(36) NULL,
  metric_type VARCHAR(60) NOT NULL,
  value DECIMAL(12,3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  external_id VARCHAR(190) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_health_metrics_athlete_type_time (athlete_user_id, metric_type, start_time),
  CONSTRAINT fk_health_metrics_athlete_user FOREIGN KEY (athlete_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

INSERT INTO schema_migrations (version, notes)
VALUES ('002_fitlytix_core_auth_assessments', 'Additive core tables for users, sessions, sports, athlete_profiles, assessments, body_analysis_records, and health_metrics')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
