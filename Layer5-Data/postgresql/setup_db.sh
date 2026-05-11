#!/bin/bash
# =============================================================
# CrisisLink Database Setup Script
# Layer5-Data/postgresql/setup_db.sh
#
# Usage:  bash Layer5-Data/postgresql/setup_db.sh
# Run from the repo root (Crisislink/).
# =============================================================

set -e   # stop on first error

DB_NAME="crisislink_db"
DB_USER="$(whoami)"   # uses your macOS login (default Homebrew postgres user)
SCHEMA_DIR="Layer5-Data/postgresql/schema"

echo "──────────────────────────────────────────"
echo " CrisisLink Database Setup"
echo "──────────────────────────────────────────"

# 1. Create the database (skip if it already exists)
echo "→ Creating database '${DB_NAME}' (if not exists)..."
psql -U "${DB_USER}" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" \
  | grep -q 1 \
  || psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
echo "  ✓ Database ready"

# 2. Run ordered schema files
echo "→ Applying schema files from ${SCHEMA_DIR}..."
for schema_file in "${SCHEMA_DIR}"/0*.sql; do
  [ -f "${schema_file}" ] || continue
  echo "   - $(basename "${schema_file}")"
  psql -U "${DB_USER}" -d "${DB_NAME}" -f "${schema_file}"
done
echo "  ✓ Schemas applied"

# 3. Verify tables were created
echo "→ Tables created in '${DB_NAME}':"
psql -U "${DB_USER}" -d "${DB_NAME}" -c \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

echo ""
echo "✅  Setup complete. Connect with:"
echo "    psql -U ${DB_USER} -d ${DB_NAME}"
echo ""
echo "    Backend connection string (for .env):"
echo "    DATABASE_URL=postgresql://${DB_USER}@localhost:5432/${DB_NAME}"
