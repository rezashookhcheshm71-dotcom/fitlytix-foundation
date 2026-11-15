#!/usr/bin/env bash
#
# One-shot deployment for FitLytix on cPanel / CloudLinux (Passenger + Node 22).
#
#   bash scripts/deploy-cpanel.sh                  # backup, update code, npm ci, build, restart
#   bash scripts/deploy-cpanel.sh --with-migrations # + apply snapshots migrations (004/005)
#   bash scripts/deploy-cpanel.sh --dry-run         # print what would happen
#   bash scripts/deploy-cpanel.sh --no-backup       # skip the tarball backup
#
# Why a script: the build on this host needs a very specific environment
# (RAYON_NUM_THREADS=1 ... , dev dependencies installed, Passenger restarted afterwards) and
# pasting a dozen commands into an SSH session repeatedly mangled the input.
#
# What it never does: touch .htaccess, delete .output before a successful build, or run a
# database migration unless --with-migrations is passed.
set -euo pipefail

BRANCH="${BRANCH:-arena/9adac5a4-fitlytix-foundation}"
REPO="${REPO:-rezashookhcheshm71-dotcom/fitlytix-foundation}"
APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
ENV_FILE="${ENV_FILE:-$HOME/fitlytix.env}"
TARBALL="/tmp/fitlytix-app.tar.gz"
BACKUP_DIR="${BACKUP_DIR:-$HOME/deploy-backups}"

WITH_MIGRATIONS=0
DRY_RUN=0
DO_BACKUP=1

for arg in "$@"; do
  case "$arg" in
    --with-migrations) WITH_MIGRATIONS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --no-backup) DO_BACKUP=0 ;;
    -h | --help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

log() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[dry-run] %s\n' "$*"
  else
    eval "$@"
  fi
}

[ -d "$APP_DIR" ] || {
  echo "app directory not found: $APP_DIR" >&2
  exit 1
}
cd "$APP_DIR"

# --- node / npm from the cPanel nodevenv ----------------------------------
NODEVENV_ACTIVATE="$HOME/nodevenv/public_html/fitlytix-app/22/bin/activate"
if [ -f "$NODEVENV_ACTIVATE" ]; then
  # shellcheck disable=SC1090
  source "$NODEVENV_ACTIVATE"
fi
command -v node >/dev/null || {
  echo "node not found — run: source $NODEVENV_ACTIVATE" >&2
  exit 1
}
log "node $(node --version) / npm $(npm --version)"

# --- 1. backup -------------------------------------------------------------
if [ "$DO_BACKUP" = "1" ]; then
  run "mkdir -p '$BACKUP_DIR'"
  STAMP=$(date +%F-%H%M)
  run "tar --exclude=node_modules --exclude=.output --exclude=.git -czf '$BACKUP_DIR/app-$STAMP.tgz' -C '$(dirname "$APP_DIR")' '$(basename "$APP_DIR")'"
  log "backup: $BACKUP_DIR/app-$STAMP.tgz"
fi

# --- 2. fetch code ---------------------------------------------------------
log "fetching $REPO@$BRANCH"
run "curl -fL --retry 3 -o '$TARBALL' 'https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH'"
# --strip-components drops the top directory; .htaccess, tmp/ and .output stay untouched.
run "tar -xzf '$TARBALL' -C '$APP_DIR' --strip-components=1"

# --- 3. dependencies (dev deps are required to build) ----------------------
# npm config here sets omit=dev, which breaks `vite build`; clear it for this install.
log "installing dependencies (including dev)"
run "cd '$APP_DIR' && npm_config_omit= npm ci --include=dev --no-audit --no-fund"

# --- 4. build --------------------------------------------------------------
# Rolldown/Rayon panics with the default thread pool on this container.
log "building"
run "cd '$APP_DIR' && RAYON_NUM_THREADS=1 RAYON_RS_NUM_CPUS=1 UV_THREADPOOL_SIZE=2 NODE_OPTIONS=--max-old-space-size=1536 npm run build"
if [ "$DRY_RUN" != "1" ] && [ ! -f ".output/server/index.mjs" ]; then
  echo "build output missing: .output/server/index.mjs" >&2
  exit 1
fi

# --- 5. migrations (opt-in) ------------------------------------------------
if [ "$WITH_MIGRATIONS" = "1" ]; then
  log "applying database migrations (004, 005)"
  # Credentials: ~/fitlytix.env first, then the SetEnv block in .htaccess.
  if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a && . "$ENV_FILE" && set +a
  fi
  DB_HOST="${DB_HOST:-$(grep -E '^SetEnv[[:space:]]+DB_HOST' .htaccess 2>/dev/null | awk '{print $3}')}"
  DB_NAME="${DB_NAME:-$(grep -E '^SetEnv[[:space:]]+DB_NAME' .htaccess 2>/dev/null | awk '{print $3}')}"
  DB_USER="${DB_USER:-$(grep -E '^SetEnv[[:space:]]+DB_USER' .htaccess 2>/dev/null | awk '{print $3}')}"
  DB_PASSWORD="${DB_PASSWORD:-$(grep -E '^SetEnv[[:space:]]+DB_PASSWORD' .htaccess 2>/dev/null | awk '{print $3}')}"
  # Trailing spaces in SetEnv values are invisible and break the MySQL login.
  trim() { printf '%s' "$1" | tr -d '[:space:]'; }
  DB_HOST="$(trim "${DB_HOST:-localhost}")"
  DB_NAME="$(trim "${DB_NAME:-}")"
  DB_USER="$(trim "${DB_USER:-}")"
  DB_PASSWORD="${DB_PASSWORD:-}"
  DB_PASSWORD="${DB_PASSWORD## }"
  DB_PASSWORD="${DB_PASSWORD%% }"

  if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ]; then
    echo "cannot read DB_* credentials (checked $ENV_FILE and .htaccess) — apply the SQL manually" >&2
  elif ! command -v mysql >/dev/null; then
    echo "mysql client not found — apply the SQL from docs/DEPLOY_RUNBOOK_FA.md manually" >&2
  else
    MYSQL=(mysql -h "${DB_HOST:-localhost}" -u "$DB_USER" "-p$DB_PASSWORD" "$DB_NAME")
    if [ "$DRY_RUN" = "1" ]; then
      printf '[dry-run] %s < 004_recommendation_snapshots.sql\n' "${MYSQL[*]}"
      printf '[dry-run] %s -e "ALTER TABLE recommendation_snapshots ADD COLUMN seq ..."\n' "${MYSQL[*]}"
    else
      # 004 is idempotent (CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE VIEW).
      "${MYSQL[@]}" < database/migrations/mysql/004_recommendation_snapshots.sql
      # 005 is an ALTER; error 1060 simply means it was applied before.
      if ! "${MYSQL[@]}" -e "ALTER TABLE recommendation_snapshots ADD COLUMN seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD KEY idx_snapshot_seq (seq)" 2>/tmp/mig005.err; then
        if grep -q "1060" /tmp/mig005.err; then
          echo "(005 already applied — duplicate column seq)"
        else
          cat /tmp/mig005.err >&2
        fi
      fi
      "${MYSQL[@]}" -e "CREATE OR REPLACE VIEW v_latest_recommendation AS SELECT s.* FROM recommendation_snapshots s JOIN (SELECT user_id, MAX(seq) AS seq FROM recommendation_snapshots GROUP BY user_id) latest ON latest.user_id = s.user_id AND latest.seq = s.seq"
    fi
    log "migrations done"
  fi
fi

# --- 6. restart Passenger --------------------------------------------------
log "restarting application"
run "mkdir -p '$APP_DIR/tmp'"
run "touch '$APP_DIR/tmp/restart.txt'"

cat <<EOF

Deployment finished.

Verify (in a browser, the server cannot reach its own domain):
  1) https://app.fitlytix.ir/api/health      -> {"ok":true,...}
  2) https://app.fitlytix.ir/api/db-test     -> {"ok":true,"rows":[...]}
  3) sign in, open /athlete/program          -> model plan, not demo data
  4) /api/plan-diagnose                      -> migrations + storedSnapshot

Automatic end-to-end check (14 assertions, needs a second local instance):
  cd $APP_DIR && PORT=3999 node .output/server/index.mjs &   # with DB_* env exported
  E2E_BASE_URL=http://127.0.0.1:3999 E2E_EMAIL=e2e@example.com E2E_PASSWORD=Test1234x E2E_REGISTER=1 node scripts/e2e-plan.mjs

Backup (if anything is wrong):
  cd $(dirname "$APP_DIR") && tar -xzf $BACKUP_DIR/app-<stamp>.tgz
  touch $APP_DIR/tmp/restart.txt
EOF
