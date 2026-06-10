ALTER TABLE problem_clusters
  ADD COLUMN IF NOT EXISTS canonical_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_problem_clusters_canonical_key
  ON problem_clusters(canonical_key);
