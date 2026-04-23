#!/usr/bin/env bash
# db-clean.sh — Clean test databases between test runs
# Requirements: 16.3

set -e

echo "[db-clean] Truncating PostgreSQL test tables..."
PGPASSWORD=test_password psql \
  -h localhost -p 5433 \
  -U fitsense_test -d fitsense_test \
  -c "TRUNCATE TABLE ml_recommendations, sessions, devices, invite_codes, password_reset_tokens, users, clubs CASCADE;"

echo "[db-clean] Flushing Redis test DB..."
redis-cli -p 6380 FLUSHDB

echo "[db-clean] Deleting InfluxDB test data..."
curl -s -X POST "http://localhost:8087/api/v2/delete" \
  -H "Authorization: Token test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "start": "1970-01-01T00:00:00Z",
    "stop": "2099-12-31T23:59:59Z",
    "predicate": "_measurement=\"hr_data\""
  }' \
  --data-urlencode "org=fitsense_test" \
  --data-urlencode "bucket=heartrate_test"

echo "[db-clean] Done."
