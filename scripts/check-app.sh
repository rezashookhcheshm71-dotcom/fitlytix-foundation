#!/usr/bin/env bash
#
# «سایت باز نمی‌شود» — آیا مشکل از کد است یا از Passenger/دامنه؟
#
#   bash scripts/check-app.sh
#
# روش: همان بیلد را روی یک پورت محلی (پیش‌فرض ۳۹۹۷) برای چند ثانیه بالا می‌آورد و
# سه نقطهٔ انتهایی را می‌زند. اگر اینجا سالم بود ولی دامنه نه، مشکل از Passenger/Apache است.
# اگر همین‌جا هم بالا نیامد، خروجی خطای node در انتها نشان داده می‌شود (مثلاً ماژول گم‌شده).
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
PORT="${PORT:-$((3990 + $$ % 8))}"
cd "$APP_DIR" 2>/dev/null || { echo "پوشهٔ اپ پیدا نشد: $APP_DIR"; exit 1; }

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

if [ ! -f .output/server/index.mjs ]; then
  bad "بیلد تولیدی نیست (.output/server/index.mjs)"
  echo "  اقدام: bash scripts/finish-setup.sh"
  exit 1
fi
ok "بیلد تولیدی موجود است"

command -v curl >/dev/null || { bad "curl روی هاست نیست"; exit 1; }

# --- credentials ------------------------------------------------------------
trim() { printf '%s' "$1" | tr -d '[:space:]'; }
# Read a value from .htaccess without tripping `set -e` when the file is missing.
ht() { grep -E "^SetEnv[[:space:]]+$1" .htaccess 2>/dev/null | awk '{print $3}' || true; }
DB_NAME="$(trim "${DB_NAME:-$(ht DB_NAME)}")"
DB_USER="$(trim "${DB_USER:-$(ht DB_USER)}")"
DB_PASSWORD="${DB_PASSWORD:-$(ht DB_PASSWORD)}"
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  info "اعتبارنامهٔ دیتابیس پیدا نشد؛ تست بدون دیتابیس اجرا می‌شود"
fi
ok "اعتبارنامه خوانده شد (DB_NAME=$DB_NAME)"

# --- temporary instance -----------------------------------------------------
LOG="/tmp/fitlytix-checkapp-$PORT.log"
SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')"

head_ "بالا آوردن نمونهٔ محلی روی پورت $PORT"
env DB_HOST="${DB_HOST:-localhost}" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  SESSION_SECRET="$SECRET" PORT="$PORT" NODE_ENV=production \
  setsid nohup node .output/server/index.mjs > "$LOG" 2>&1 < /dev/null &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

UP=0
for _ in $(seq 1 30); do
  if curl -fsS -m 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then UP=1; break; fi
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done

if [ "$UP" != "1" ]; then
  bad "نمونهٔ محلی بالا نیامد"
  head_ "خطای node (آخرین ۲۵ خط)"
  tail -25 "$LOG" 2>/dev/null | sed 's/^/     /'
  head_ "اقدام بعدی"
  echo "  اگر «Cannot find module» دیدید، بیلد با نسخهٔ ناقص ساخته شده:"
  echo "     bash scripts/finish-setup.sh        # دوباره npm ci + build بدون prune"
  echo "  اگر چیز دیگری بود، همین خروجی را بفرستید."
  exit 1
fi
ok "نمونهٔ محلی بالا آمد (کد سالم است)"

# --- probes -----------------------------------------------------------------
LAST_CODE=""
LAST_BODY=""
probe() {
  local path="$1" expect="$2" code
  code=$(curl -s -m 10 -o /tmp/fitlytix-probe.out -w '%{http_code}' "http://127.0.0.1:$PORT$path" 2>/dev/null)
  LAST_CODE="$code"
  LAST_BODY=$(head -c 300 /tmp/fitlytix-probe.out 2>/dev/null | tr -d '\n')
  printf '  %s = %s\n' "$path" "$code"
  printf '     %s\n' "$LAST_BODY"
  if [ "$code" = "$expect" ]; then
    ok "وضعیت HTTP مطابق انتظار ($expect)"
  else
    bad "انتظار $expect بود، $code آمد"
  fi
}

head_ "بررسی نقطه‌های انتهایی"
probe "/api/health" "200"
HEALTH="$LAST_CODE"
probe "/api/db-test" "200"
DBTEST="$LAST_CODE"
DBBODY="$LAST_BODY"
probe "/api/auth/me" "401"

head_ "نتیجه"
if [ "$HEALTH" != "200" ]; then
  bad "خود اپ روی سرور سالم نیست — این خطا با Passenger هم دیده می‌شود"
  head_ "اقدام بعدی"
  echo "  tail -25 $LOG"
  echo "  سپس همین خروجی را بفرستید."
elif [ "$DBTEST" != "200" ]; then
  bad "اپ سالم است ولی دیتابیس وصل نمی‌شود"
  if printf '%s' "$DBBODY" | grep -q "DB_NOT_CONFIGURED"; then
    info "یعنی متغیرهای DB_* به اپ نرسیده‌اند (SetEnv در .htaccess)"
  fi
  head_ "اقدام بعدی"
  echo "  grep -c '^SetEnv' .htaccess        # باید حداقل ۵ باشد"
  echo "  و سپس: touch tmp/restart.txt"
else
  ok "کد، دیتابیس و لایهٔ نشست روی سرور سالم‌اند"
  info "پس اگر دامنه باز نمی‌شود، مشکل از Passenger/Apache در cPanel است، نه از اپ."
  head_ "اقدام بعدی"
  echo "  ۱) tail -40 logs/passenger.log"
  echo "  ۲) touch tmp/restart.txt"
  echo "  ۳) در مرورگر: https://app.fitlytix.ir/api/health"
  echo "  ۴) اگر اپ بالا بود اما وارد نمی‌شوید: bash scripts/check-login.sh"
fi
echo ""
