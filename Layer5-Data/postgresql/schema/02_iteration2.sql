-- =============================================================
-- CrisisLink Database Schema  v2.0  (Iteration 2 additions)
-- Layer5-Data/postgresql/schema/02_iteration2.sql
--
-- Run this file ONCE against an existing database that already
-- has the v1.1 schema applied (01_init.sql).  All statements
-- use IF NOT EXISTS / IF EXISTS so the file is safe to re-run.
-- =============================================================

-- ── Registration form fields on organization ──────────────────
-- business_address  : street address of the org / donor (optional)
-- preferred_location: donor's preferred food drop-off address    (donor)
-- max_pickup_distance_km: max km org will travel to collect food (community_org)

ALTER TABLE organization
    ADD COLUMN IF NOT EXISTS business_address          VARCHAR(500),
    ADD COLUMN IF NOT EXISTS preferred_location        VARCHAR(500),
    ADD COLUMN IF NOT EXISTS max_pickup_distance_km    INT;
