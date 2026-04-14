-- =============================================================
-- CrisisLink Database Schema  v1.1
-- Layer5-Data/postgresql/schema/01_init.sql
-- =============================================================

DROP TABLE IF EXISTS translation            CASCADE;
DROP TABLE IF EXISTS organization_workplace CASCADE;
DROP TABLE IF EXISTS food_listing           CASCADE;
DROP TABLE IF EXISTS coordinator_account    CASCADE;
DROP TABLE IF EXISTS organization           CASCADE;
DROP TABLE IF EXISTS location               CASCADE;
DROP TABLE IF EXISTS region_categories      CASCADE;
DROP TABLE IF EXISTS language               CASCADE;

-- ── 1. language ───────────────────────────────────────────────
CREATE TABLE language (
    language_id   SERIAL       PRIMARY KEY,
    lang_name     VARCHAR(100) NOT NULL
);

-- ── 2. region_categories ──────────────────────────────────────
CREATE TABLE region_categories (
    postcode          VARCHAR(10)  PRIMARY KEY,
    regional_category VARCHAR(100) NOT NULL
);

-- ── 3. location ───────────────────────────────────────────────
CREATE TABLE location (
    location_id    SERIAL         PRIMARY KEY,
    unit_address   VARCHAR(50),
    street_address VARCHAR(255)   NOT NULL,
    suburb         VARCHAR(100),
    city           VARCHAR(100),
    postcode       VARCHAR(10)    NOT NULL,
    latitude       DECIMAL(9,6),
    longitude      DECIMAL(9,6),
    FOREIGN KEY (postcode) REFERENCES region_categories(postcode)
);

-- ── 4. organization ───────────────────────────────────────────
-- SERIAL: org_id auto-increments so we can upsert orgs by org_code
-- UNIQUE (org_code): allows INSERT ... ON CONFLICT (org_code) DO NOTHING
CREATE TABLE organization (
    org_id             SERIAL       PRIMARY KEY,
    org_name           VARCHAR(255) NOT NULL,
    org_code           VARCHAR(50)  UNIQUE,
    postcode           VARCHAR(10),
    contact_phone      VARCHAR(30),
    contact_email      VARCHAR(255),
    org_type           VARCHAR(100),
    preferred_language INT,
    FOREIGN KEY (preferred_language) REFERENCES language(language_id)
);

-- ── 5. food_listing ───────────────────────────────────────────
-- listing_id : VARCHAR(36) UUID from the backend
-- postcode   : denormalised copy for fast feed filtering without joins
-- org_code   : denormalised copy so GET /listings can return orgCode
--              without an extra JOIN every time
-- org_id     : nullable — resolved via get_or_create_org() in backend
CREATE TABLE food_listing (
    listing_id         VARCHAR(36)   PRIMARY KEY,
    title              VARCHAR(255)  NOT NULL,
    description        TEXT,
    quantity           DECIMAL(10,2) NOT NULL,
    unit               VARCHAR(50),
    food_category      VARCHAR(100),
    dietary_tags       VARCHAR(255),
    photo_url          VARCHAR(500),
    postcode           VARCHAR(10),
    org_code           VARCHAR(50),
    expiry_date        DATE,
    pickup_time        TIMESTAMP,
    status             VARCHAR(50)   DEFAULT 'available',
    created_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    claimed_at         TIMESTAMP,
    org_id             INT,
    claimed_by_org_id  INT,
    location_id        INT,
    FOREIGN KEY (org_id)            REFERENCES organization(org_id),
    FOREIGN KEY (claimed_by_org_id) REFERENCES organization(org_id),
    FOREIGN KEY (location_id)       REFERENCES location(location_id)
);

-- ── 6. coordinator_account ────────────────────────────────────
CREATE TABLE coordinator_account (
    user_id            SERIAL       PRIMARY KEY,
    org_id             INT          NOT NULL,
    name               VARCHAR(255) NOT NULL,
    phone              VARCHAR(30),
    email              VARCHAR(255),
    role               VARCHAR(100),
    preferred_language INT,
    FOREIGN KEY (org_id)             REFERENCES organization(org_id),
    FOREIGN KEY (preferred_language) REFERENCES language(language_id)
);

-- ── 7. translation ────────────────────────────────────────────
CREATE TABLE translation (
    translation_id    SERIAL       PRIMARY KEY,
    listing_id        VARCHAR(36)  NOT NULL,
    language_id       INT          NOT NULL,
    translated_title  VARCHAR(255),
    trans_description TEXT,
    FOREIGN KEY (listing_id)  REFERENCES food_listing(listing_id),
    FOREIGN KEY (language_id) REFERENCES language(language_id),
    UNIQUE (listing_id, language_id)
);

-- ── 8. organization_workplace ─────────────────────────────────
CREATE TABLE organization_workplace (
    org_id      INT NOT NULL,
    location_id INT NOT NULL,
    PRIMARY KEY (org_id, location_id),
    FOREIGN KEY (org_id)      REFERENCES organization(org_id),
    FOREIGN KEY (location_id) REFERENCES location(location_id)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_listing_status    ON food_listing(status);
CREATE INDEX idx_listing_postcode  ON food_listing(postcode);
CREATE INDEX idx_listing_org       ON food_listing(org_id);
CREATE INDEX idx_listing_claimed   ON food_listing(claimed_by_org_id);
CREATE INDEX idx_org_code          ON organization(org_code);
