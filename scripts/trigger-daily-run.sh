#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8787}"
API_KEY="${API_KEY:?API_KEY is required}"
RUN_MODE="${RUN_MODE:-full}"

curl -sS -X POST "$API_BASE_URL/api/internal/scheduled-run" \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"mode\":\"$RUN_MODE\"}"
