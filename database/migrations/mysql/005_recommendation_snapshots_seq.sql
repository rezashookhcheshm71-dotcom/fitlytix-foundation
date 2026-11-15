-- 005 — Stable ordering for recommendation snapshots.
--
-- Why: `created_at` is DATETIME (second precision) and one assessment submission can write
-- more than one snapshot inside the same second (common assessment → sport assessment).
-- `ORDER BY created_at DESC LIMIT 1` then returned an arbitrary row, so the athlete could
-- see the plan built from the common assessment only instead of the sport-specific one.
--
-- `seq` is a monotonic, insertion-ordered key: the newest snapshot is always MAX(seq).
-- Additive and non-destructive: safe to run on an existing database.

ALTER TABLE recommendation_snapshots
  ADD COLUMN seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ADD KEY idx_snapshot_seq (seq);

-- Latest plan per athlete, now tie-proof.
CREATE OR REPLACE VIEW v_latest_recommendation AS
SELECT s.*
FROM recommendation_snapshots s
JOIN (
  SELECT user_id, MAX(seq) AS seq
  FROM recommendation_snapshots
  GROUP BY user_id
) latest ON latest.user_id = s.user_id AND latest.seq = s.seq;
