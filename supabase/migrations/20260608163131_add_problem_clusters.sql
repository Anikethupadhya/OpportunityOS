CREATE TABLE IF NOT EXISTS problem_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  problem_category text,
  specificity integer CHECK (specificity BETWEEN 1 AND 5),
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  human_status text CHECK (human_status IN ('would_build','would_not_build','maybe')),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_clusters_status
  ON problem_clusters(human_status);

CREATE INDEX IF NOT EXISTS idx_problem_clusters_last_seen
  ON problem_clusters(last_seen_at DESC);

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS raw_problem_hint text,
  ADD COLUMN IF NOT EXISTS cluster_id uuid
    REFERENCES problem_clusters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_cluster_id
  ON opportunities(cluster_id);
