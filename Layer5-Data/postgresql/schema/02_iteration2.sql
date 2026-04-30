-- =============================================================
-- OutbackShare Iteration 2 schema migration
-- Layer5-Data/postgresql/schema/02_iteration2.sql
-- Adds SEIFA reference table + weekly postcode risk scores table.
-- =============================================================

DROP TABLE IF EXISTS postcode_risk_scores CASCADE;
DROP TABLE IF EXISTS postcode_seifa CASCADE;

CREATE TABLE postcode_seifa (
    postcode          VARCHAR(10)  PRIMARY KEY,
    irsd_score        NUMERIC(12,4) NOT NULL,
    irsd_decile       INT          NOT NULL CHECK (irsd_decile BETWEEN 1 AND 10),
    total_population  INT          NOT NULL CHECK (total_population >= 0),
    regional_category VARCHAR(100) NOT NULL,
    last_updated      DATE         NOT NULL DEFAULT CURRENT_DATE,
    FOREIGN KEY (postcode) REFERENCES region_categories(postcode)
);

CREATE TABLE postcode_risk_scores (
    risk_score_id      BIGSERIAL    PRIMARY KEY,
    postcode           VARCHAR(10)  NOT NULL,
    week_start         DATE         NOT NULL,
    demand_risk_score  NUMERIC(4,3) NOT NULL CHECK (demand_risk_score >= 0 AND demand_risk_score <= 1),
    top_features       JSONB,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postcode) REFERENCES region_categories(postcode),
    UNIQUE (postcode, week_start)
);

CREATE INDEX idx_seifa_decile               ON postcode_seifa(irsd_decile);
CREATE INDEX idx_seifa_regional_category    ON postcode_seifa(regional_category);

CREATE INDEX idx_risk_week_start            ON postcode_risk_scores(week_start);
CREATE INDEX idx_risk_demand_score          ON postcode_risk_scores(demand_risk_score);
CREATE INDEX idx_risk_postcode              ON postcode_risk_scores(postcode);
