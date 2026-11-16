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
# Exported under its own name: the env file below may define PORT (for the live app), and a
# short-lived export instance must never inherit it.
EXPORT_PORT="${EXPORT_PORT:-3998}"
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

# Node is guaranteed here (the app runs on it), openssl is not.
TOKEN="${DATASET_EXPORT_TOKEN:-$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')}"
[ -n "$TOKEN" ] || {
  echo "cannot generate an export token" >&2
  exit 1
}

# --- short-lived instance --------------------------------------------------
LOG="/tmp/fitlytix-export-$EXPORT_PORT.log"
env DB_HOST="$DB_HOST" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  SESSION_SECRET="$TOKEN" PORT="$EXPORT_PORT" DATASET_EXPORT_TOKEN="$TOKEN" \
  setsid nohup node .output/server/index.mjs > "$LOG" 2>&1 < /dev/null &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$EXPORT_PORT/api/health" > /dev/null 2>&1; then break; fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$EXPORT_PORT/api/health" > /dev/null 2>&1; then
  echo "the export instance did not start — see $LOG" >&2
  tail -20 "$LOG" >&2
  exit 1
fi

# Confirm the listener is *our* instance: a stale process on the same port would answer
# /api/health too, then reject our fresh token with 403. Any other status is a real bug in
# the endpoint, so print what the endpoint actually said instead of blaming the port.
PROBE_BODY="/tmp/fitlytix-export-probe.json"
PROBE_CODE=$(curl -s -m 30 -o "$PROBE_BODY" -w '%{http_code}' \
  "http://127.0.0.1:$EXPORT_PORT/api/dataset-export?token=$TOKEN&limit=1" || echo "000")

if [ "$PROBE_CODE" != "200" ]; then
  echo "export endpoint returned HTTP $PROBE_CODE" >&2
  head -c 400 "$PROBE_BODY" 2>/dev/null | sed 's/^/  /' >&2
  echo >&2
  if [ "$PROBE_CODE" = "403" ]; then
    echo "the token was rejected — port $EXPORT_PORT is probably held by another instance;" \
      "retry with EXPORT_PORT=$((EXPORT_PORT - 1))" >&2
  else
    echo "this is the endpoint's own error (see the JSON above and the log tail below)," >&2
    echo "not a port conflict — send that message to whoever maintains the app." >&2
  fi
  tail -20 "$LOG" >&2
  exit 1
fi

# --- export ----------------------------------------------------------------
DATASET_BASE_URL="http://127.0.0.1:$EXPORT_PORT" DATASET_DIR="$DATASET_DIR" node scripts/export-dataset.mjs

# --- retention -------------------------------------------------------------
if [ -d "$DATASET_DIR" ]; then
  ls -1t "$DATASET_DIR"/dataset-*.jsonl 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
    rm -f "$old" "${old%.jsonl}.report.json"
  done
fi

echo "done — kept the newest $KEEP datasets in $DATASET_DIR"
