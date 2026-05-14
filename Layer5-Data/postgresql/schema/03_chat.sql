-- =============================================================
-- CrisisLink Chat System  (Iteration 3)
-- Layer5-Data/postgresql/schema/03_chat.sql
--
-- Run AFTER 01_init.sql and 02_iteration2.sql.
-- All statements use IF NOT EXISTS so the file is safe to re-run.
-- =============================================================

-- ── Add 'collected' to the food_listing status domain ─────────
-- No ALTER TYPE needed — status is VARCHAR, values are enforced
-- by the application layer.

-- ── 1. chat_session ───────────────────────────────────────────
-- One row per food listing that has been claimed.
-- Both parties exchange ephemeral EC P-256 public keys here.
-- The private keys NEVER leave the browser.
--
-- Shared AES-256-GCM key = HKDF(
--     ECDH(my_ephemeral_private, their_ephemeral_public),
--     salt  = listing_id,
--     info  = donor_org_code || '|' || claimer_org_code || '|' || listing_id
-- )
-- This ties the derived key to both organisation codes (ephemeral).

CREATE TABLE IF NOT EXISTS chat_session (
    listing_id         VARCHAR(36)  PRIMARY KEY,
    donor_org_code     VARCHAR(50)  NOT NULL,
    claimer_org_code   VARCHAR(50)  NOT NULL,
    donor_public_key   TEXT,            -- JSON-serialised JWK (EC P-256)
    claimer_public_key TEXT,            -- JSON-serialised JWK (EC P-256)
    created_at         TIMESTAMP    DEFAULT NOW(),
    FOREIGN KEY (listing_id) REFERENCES food_listing(listing_id) ON DELETE CASCADE
);

-- ── 2. chat_message ───────────────────────────────────────────
-- Encrypted ciphertexts only — plaintext never hits the server.
-- Cascade-deleted when chat_session is removed (food collected).

CREATE TABLE IF NOT EXISTS chat_message (
    message_id      SERIAL       PRIMARY KEY,
    listing_id      VARCHAR(36)  NOT NULL,
    sender_org_code VARCHAR(50)  NOT NULL,
    ciphertext      TEXT         NOT NULL,   -- base64 AES-256-GCM ciphertext
    iv              TEXT         NOT NULL,   -- base64 96-bit IV
    created_at      TIMESTAMP    DEFAULT NOW(),
    FOREIGN KEY (listing_id) REFERENCES chat_session(listing_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_listing ON chat_message(listing_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_time    ON chat_message(listing_id, created_at);
