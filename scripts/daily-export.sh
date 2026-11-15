#!/usr/bin/env bash
#
# Nightly dataset export, without touching the live Passenger app.
#
#   bash scripts/daily-export.sh                 # export + keep the last 14 datasets
#   KEEP=30 bash scripts/daily-export.sh         # keep more history
#   PORT=3998 bash scripts/daily-export.sh
#
# Why a separate instance: the export endpoint is deliberately not enabled on the production
# app (it would expose aggregated athlete data if the token leaked). This script boots a
# short-lived instance on localhost with DATASET_EXPORT_TOKEN set, exports, and shuts it down.
#
# Cron (daily 03:10):
#   10 3 * * * cd $HOME/public_html/fitlytix-app && /bin/bash scripts/daily-export.sh >> $HOME/logs/dataset-export.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
PORT="${PORT:-3998}"
KEEP="${KEEP:-14}"
DATASET_DIR="${DATASET_DIR:-$APP_DIR/data/datasets}"
ENV_FILE="${ENV_FILE:-$HOME/fitlytix.env}"

cd "$APP_DIR"

[ -f .output/server/index.mjs ] || {
  echo "build output missing — deploy first" >&2
  exit 1
}

# --- credentials -----------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  set +u
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set -u
fi
trim() { printf '%s' "$1" | tr -d '[:space:]'; }
DB_HOST="$(trim "${DB_HOST:-localhost}")"
DB_NAME="$(trim "${DB_NAME:-$(grep -E '^SetEnv[[:space:]]+DB_NAME' .htaccess | awk '{print $3}')}")"
DB_USER="$(trim "${DB_USER:-$(grep -E '^SetEnv[[:space:]]+DB_USER' .htaccess | awk '{print $3}')}")"
DB_PASSWORD="${DB_PASSWORD:-$(grep -E '^SetEnv[[:space:]]+DB_PASSWORD' .htaccess | awk '{print $3}')}"
[ -n "$DB_NAME" ] && [ -n "$DB_USER" ] || {
  echo "cannot read DB_* credentials" >&2
  exit 1
}

TOKEN="${DATASET_EXPORT_TOKEN:-$(openssl rand -hex 24)}"
export DATASET_EXPORT_TOKEN="$TOKEN"

# --- short-lived instance --------------------------------------------------
LOG="/tmp/fitlytix-export-$PORT.log"
env DB_HOST="$DB_HOST" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  SESSION_SECRET="dataset-export" PORT="$PORT" DATASET_EXPORT_TOKEN="$TOKEN" \
  setsid nohup node .output/server/index.mjs > "$LOG" 2>&1 < /dev/null &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then break; fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
  echo "the export instance did not start — see $LOG" >&2
  tail -20 "$LOG" >&2
  exit 1
fi

# --- export ----------------------------------------------------------------
DATASET_BASE_URL="http://127.0.0.1:$PORT" DATASET_DIR="$DATASET_DIR" node scripts/export-dataset.mjs

# --- retention -------------------------------------------------------------
if [ -d "$DATASET_DIR" ]; then
  ls -1t "$DATASET_DIR"/dataset-*.jsonl 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
    rm -f "$old" "${old%.jsonl}.report.json"
  done
fi

echo "done — kept the newest $KEEP datasets in $DATASET_DIR"
