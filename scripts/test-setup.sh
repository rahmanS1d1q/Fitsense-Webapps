#!/usr/bin/env bash
# test-setup.sh — Spin up test environment, run migrations, run tests, tear down
# Requirements: 16.1, 16.3, 20.1, 20.2

set -e

echo "[test-setup] Starting test environment..."
docker compose -f docker-compose.test.yml up -d

echo "[test-setup] Waiting for services to be healthy..."
sleep 10

echo "[test-setup] Running PostgreSQL migrations (test DB)..."
cd apps/api
TEST_DATABASE_URL="postgresql://fitsense_test:test_password@localhost:5433/fitsense_test" \
  npm run db:migrate:test
cd ../..

echo "[test-setup] Running API Server tests..."
cd apps/api
DATABASE_URL="postgresql://fitsense_test:test_password@localhost:5433/fitsense_test" \
  INFLUX_URL="http://localhost:8087" \
  INFLUX_TOKEN="test-token" \
  INFLUX_ORG="fitsense_test" \
  INFLUX_BUCKET="heartrate_test" \
  REDIS_URL="redis://localhost:6380" \
  npm test -- --runInBand
cd ../..

echo "[test-setup] Running ML Service tests..."
cd apps/ml
DATABASE_URL="postgresql://fitsense_test:test_password@localhost:5433/fitsense_test" \
  INFLUX_URL="http://localhost:8087" \
  INFLUX_TOKEN="test-token" \
  REDIS_URL="redis://localhost:6380" \
  python -m pytest tests/ -v
cd ../..

echo "[test-setup] Tearing down test environment..."
docker compose -f docker-compose.test.yml down -v

echo "[test-setup] Done."
