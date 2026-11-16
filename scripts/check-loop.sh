#!/usr/bin/env bash
#
# آیا حلقهٔ داده واقعاً کار می‌کند؟ — یک دستور، بدون مرورگر.
#
#   bash scripts/check-loop.sh
#
# چه می‌کند:
#   ۱) همان بیلد را روی یک پورت محلی بالا می‌آورد (مستقل از Passenger و دامنه)
#   ۲) با ایمیل/رمز شما وارد می‌شود؛ اگر حساب نبود می‌سازد (E2E_REGISTER=1)
#   ۳) `scripts/e2e-plan.mjs` را اجرا می‌کند: ارزیابی → برنامه → ثبت جلسه، چک‌این و وعده
#      → خواندن دوباره → دیاگنوز (۱۴ بررسی، همان تست موجود و آزموده‌شده)
#   ۴) روی همان داده، «حقیقت دیتابیس» را می‌خواند: اسنپ‌شات، جلسات، و برچسب پایبندی
#      (recommendation_outcomes) — چیزی که e2e نمی‌بیند
#   ۵) می‌گوید قدم بعدی چیست: daily-export، loop-status، صفحهٔ مربی
#
# چرا: تا وقتی یک ردیف برچسب‌خورده نباشد، دیتاست خالی است و بازآموزی ممکن نیست.
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
PORT="${PORT:-$((3980 + $$ % 8))}"
cd "$APP_DIR" 2>/dev/null || { echo "پوشهٔ اپ پیدا نشد: $APP_DIR"; exit 1; }

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

[ -f .output/server/index.mjs ] || { bad "بیلد نیست → bash scripts/finish-setup.sh"; exit 1; }
[ -f scripts/e2e-plan.mjs ] || { bad "scripts/e2e-plan.mjs نیست → دوباره کد را با tar باز کنید"; exit 1; }
command -v curl >/dev/null || { bad "curl نیست"; exit 1; }

trim() { printf '%s' "$1" | tr -d '[:space:]'; }
DB_NAME="$(trim "${DB_NAME:-$(grep -E '^SetEnv[[:space:]]+DB_NAME' .htaccess 2>/dev/null | awk '{print $3}')}")"
DB_USER="$(trim "${DB_USER:-$(grep -E '^SetEnv[[:space:]]+DB_USER' .htaccess 2>/dev/null | awk '{print $3}')}")"
DB_PASSWORD="${DB_PASSWORD:-$(grep -E '^SetEnv[[:space:]]+DB_PASSWORD' .htaccess 2>/dev/null | awk '{print $3}')}"
DB_HOST="${DB_HOST:-localhost}"
MYSQL_BIN="$(command -v mysql || true)"
q() {
  [ -n "$MYSQL_BIN" ] || return 0
  MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" -h "$DB_HOST" -u "$DB_USER" -D "$DB_NAME" -N -B -e "$1" 2>/dev/null | tr -d '[:space:]'
}
esc() { printf '%s' "$1" | sed "s/'/''/g"; }

# --- temporary instance -----------------------------------------------------
LOG="/tmp/fitlytix-loop-$PORT.log"
SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')"

head_ "بالا آوردن نمونهٔ محلی روی پورت $PORT"
env DB_HOST="$DB_HOST" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  SESSION_SECRET="$SECRET" PORT="$PORT" \
  setsid nohup node .output/server/index.mjs > "$LOG" 2>&1 < /dev/null &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

UP=0
for _ in $(seq 1 30); do
  curl -fsS -m 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && { UP=1; break; }
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done
[ "$UP" = "1" ] || { bad "نمونهٔ محلی بالا نیامد"; tail -20 "$LOG" | sed 's/^/     /'; exit 1; }
ok "نمونه بالا آمد"
API="http://127.0.0.1:$PORT"

# --- account ----------------------------------------------------------------
head_ "حساب ورزشکار"
printf '  ایمیل: '
read -r EMAIL
printf '  رمز عبور (تایپ نمی‌شود): '
read -r -s PASSWORD
printf '\n'
[ -z "${EMAIL:-}" ] && { bad "ایمیل خالی است"; exit 1; }
[ "${#PASSWORD}" -lt 6 ] && { bad "رمز باید حداقل ۶ کاراکتر باشد"; exit 1; }
info "اگر این حساب نباشد، ساخته می‌شود (ثبت‌نام + ارزیابی + برنامه)"

# --- the tested end-to-end harness -----------------------------------------
head_ "اجرای آزمون end-to-end (۱۴ بررسی)"
E2E_BASE_URL="$API" E2E_EMAIL="$EMAIL" E2E_PASSWORD="$PASSWORD" E2E_REGISTER=1 \
  node scripts/e2e-plan.mjs
E2E_STATUS=$?

# --- database truth ---------------------------------------------------------
head_ "حقیقت دیتابیس (چیزی که e2e نمی‌بیند)"
E=$(esc "$EMAIL")
if [ -z "$MYSQL_BIN" ]; then
  info "mysql CLI نیست؛ این کوئری‌ها را در phpMyAdmin اجرا کنید:"
  echo "     SELECT COUNT(*) FROM recommendation_snapshots WHERE user_id = (SELECT id FROM users WHERE LOWER(email)='$E');"
  echo "     SELECT COUNT(*) FROM recommendation_outcomes WHERE athlete_id = (SELECT id FROM users WHERE LOWER(email)='$E') AND adherence IS NOT NULL;"
else
  UID_=$(q "SELECT id FROM users WHERE LOWER(email) = '$E' LIMIT 1")
  if [ -z "$UID_" ]; then
    bad "کاربر در دیتابیس پیدا نشد: $EMAIL"
  else
    SNAP=$(q "SELECT COUNT(*) FROM recommendation_snapshots WHERE user_id = '$UID_'")
    SESS=$(q "SELECT COUNT(*) FROM training_sessions WHERE athlete_user_id = '$UID_'")
    LAB=$(q "SELECT COUNT(*) FROM recommendation_outcomes WHERE athlete_id = '$UID_' AND adherence IS NOT NULL")
    ok "user=$UID_"
    ok "recommendation_snapshots=$SNAP · training_sessions=$SESS · labelled_outcomes=${LAB:-0}"
    if [ "${LAB:-0}" -gt 0 ]; then
      ADH=$(q "SELECT adherence FROM recommendation_outcomes WHERE athlete_id = '$UID_' AND adherence IS NOT NULL ORDER BY recorded_at DESC LIMIT 1")
      ok "پایبندی اندازه‌گیری‌شده = $ADH"
    else
      info "برچسب پایبندی هنوز ساخته نشده — با پنجرهٔ زمانی (window_days) پر می‌شود، نه فوری"
    fi
  fi
fi

# --- verdict ----------------------------------------------------------------
head_ "نتیجه"
if [ "$E2E_STATUS" -eq 0 ]; then
  ok "کل مسیر (ورود → ارزیابی → برنامه → ثبت داده → خواندن) سالم است"
  head_ "قدم بعدی"
  echo "  ۱) bash scripts/daily-export.sh     # ساخت دیتاست با دادهٔ واقعی"
  echo "  ۲) node scripts/loop-status.mjs     # چند ردیف برچسب‌خورده داریم؟"
  echo "  ۳) در مرورگر: /coach/data-quality   # همان ورزشکار باید با sessions ≥ ۱ دیده شود"
else
  bad "آزمون با خطا تمام شد (کد خروج $E2E_STATUS) — بررسی‌های بالا را ببینید"
  echo "  لاگ نمونه: $LOG"
fi
echo ""
