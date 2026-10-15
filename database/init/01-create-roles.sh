#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${OWNER_DB_USER:?OWNER_DB_USER is required}"
: "${OWNER_DB_PASSWORD:?OWNER_DB_PASSWORD is required}"
: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v bootstrap_user="$POSTGRES_USER" \
  -v db_name="$POSTGRES_DB" \
  -v owner_user="$OWNER_DB_USER" \
  -v owner_password="$OWNER_DB_PASSWORD" \
  -v app_user="$APP_DB_USER" \
  -v app_password="$APP_DB_PASSWORD" \
  -f /sql/grants.sql
