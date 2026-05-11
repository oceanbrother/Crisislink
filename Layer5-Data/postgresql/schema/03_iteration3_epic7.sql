-- Iteration 3 (Epic 7): Pickup coordination and anonymous messaging

ALTER TABLE food_listing
  ADD COLUMN IF NOT EXISTS claim_id VARCHAR(36);

ALTER TABLE food_listing
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP;

-- Normalize old terminal state naming
UPDATE food_listing
SET status = 'collected'
WHERE status = 'picked_up';

CREATE TABLE IF NOT EXISTS claim_thread (
  -- One thread per claim. This is the durable anchor for donor/org messaging.
  claim_id VARCHAR(36) PRIMARY KEY,
  listing_id VARCHAR(36) NOT NULL,
  source_listing_id VARCHAR(36),
  donor_org_code VARCHAR(20) NOT NULL,
  claiming_org_code VARCHAR(20) NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claim_thread_listing_id
  ON claim_thread(listing_id);

CREATE TABLE IF NOT EXISTS claim_message (
  -- Message log for a claim thread. Sender role is denormalized for simpler
  -- UI rendering and permission checks.
  message_id VARCHAR(36) PRIMARY KEY,
  claim_id VARCHAR(36) NOT NULL REFERENCES claim_thread(claim_id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  sender_org_code VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claim_message_claim_id
  ON claim_message(claim_id);
