#!/usr/bin/env bash
#
# FitLytix — «کجایم؟» و «چه مانده؟» در یک دستور.
#
#   bash scripts/finish-setup.sh --status     # فقط گزارش، هیچ تغییری نمی‌دهد
#   bash scripts/finish-setup.sh              # دپلوی + تنظیم رمز/نقش + چک‌لیست پایانی
#
# چرا: کاربر نباید ده دستور را از حفظ اجرا کند. این اسکریپت هر بار وضعیت واقعی را
# می‌خواند، قدم بعدی را می‌گوید و در حالت اجرا همان قدم‌ها را خودش انجام می‌دهد.
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
MODE="${1:-run}"

if [ ! -d "$APP_DIR" ]; then
  echo "پوشهٔ اپ پیدا نشد: $APP_DIR"
  echo "اگر مسیر دیگری دارید: APP_DIR=/مسیر/درست bash scripts/finish-setup.sh --status"
  exit 1
fi
cd "$APP_DIR" || exit 1

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

dataset_count() {
  find data/datasets -maxdepth 1 -name 'dataset-*.jsonl' 2>/dev/null | wc -l | tr -d ' '
}

report() {
  head_ "۱) وضعیت فایل‌ها"
  if [ -f .output/server/index.mjs ]; then
    ok "بیلد تولیدی موجود است ($(date -r .output/server/index.mjs '+%Y-%m-%d %H:%M' 2>/dev/null))"
  else
    bad "بیلد تولیدی نیست → دپلوی لازم است"
  fi

  if grep -q "PassengerAppLogFile" .htaccess 2>/dev/null; then
    ok "لاگ Passenger در .htaccess تعریف شده"
  else
    bad "PassengerAppLogFile در .htaccess نیست (دپلوی اضافه‌اش می‌کند)"
  fi

  if [ -f logs/passenger.log ]; then
    ok "فایل لاگ ساخته شده ($(wc -c < logs/passenger.log | tr -d ' ') بایت)"
  else
    info "فایل logs/passenger.log هنوز نیست (بعد از اولین درخواست ساخته می‌شود)"
  fi

  local envs
  envs=$(grep -cE '^SetEnv[[:space:]]+DB_(NAME|USER)' .htaccess 2>/dev/null || echo 0)
  if [ "${envs:-0}" -ge 2 ]; then
    ok "اعتبارنامهٔ دیتابیس در .htaccess هست"
  else
    bad "DB_NAME/DB_USER در .htaccess نیست"
  fi

  if [ -d node_modules ]; then
    info "node_modules موجود است (با --prune بعد از بیلد پاک می‌شود)"
  else
    ok "node_modules پاک شده (طبیعی: Nitro وابستگی‌ها را باندل می‌کند)"
  fi

  head_ "۲) وضعیت داده"
  local ds
  ds=$(dataset_count)
  if [ "$ds" -gt 0 ]; then
    ok "$ds دیتاست در data/datasets"
    if [ -f scripts/loop-status.mjs ]; then
      info "برای جزئیات: node scripts/loop-status.mjs"
    fi
  else
    info "هنوز دیتاستی ساخته نشده (طبیعی تا اولین اجرای daily-export.sh)"
  fi

  head_ "۳) قدم بعدی"
  if [ ! -f .output/server/index.mjs ] || [ "${1:-}" = "force" ]; then
    echo "  → دپلوی: bash scripts/finish-setup.sh"
  elif [ ! -f logs/passenger.log ]; then
    echo "  → در مرورگر https://app.fitlytix.ir/api/db-test را باز کنید"
  else
    echo "  → در مرورگر تلاش کنید وارد شوید. اگر ۴۰۱ گرفتید:"
    echo "     bash scripts/finish-setup.sh --password"
  fi
  echo ""
}

run_deploy() {
  head_ "دپلوی"
  if [ ! -f scripts/deploy-cpanel.sh ]; then
    bad "scripts/deploy-cpanel.sh نیست — ابتدا کد را با tar باز کنید"
    exit 1
  fi

  # Stray temporary instances (from check-app/check-loop/daily-export) eat the account's
  # process limit and make the Rust bundler fail with "Resource temporarily unavailable".
  if [ -f scripts/cleanup.sh ]; then
    bash scripts/cleanup.sh --kill >/dev/null 2>&1 || true
  fi

  if bash scripts/deploy-cpanel.sh --prune; then
    ok "دپلوی تمام شد"
    return 0
  fi

  bad "دپلوی بار اول ناموفق بود"
  info "تلاش دوم با حالت کم‌مصرف (--low-mem: یک ترد، ۱ گیگابایت heap)"
  if bash scripts/deploy-cpanel.sh --prune --low-mem; then
    ok "دپلوی در تلاش دوم تمام شد"
    return 0
  fi
  bad "دپلوی در هر دو حالت ناموفق بود — خروجی بالا را بفرستید"
  exit 1
}

run_password() {
  head_ "تنظیم رمز و نقش مربی"
  if [ ! -f scripts/make-password-hash.mjs ]; then
    bad "scripts/make-password-hash.mjs نیست — ابتدا کد را با tar باز کنید"
    exit 1
  fi
  node scripts/make-password-hash.mjs --role coach
  head_ "این دو خط را در phpMyAdmin → تب SQL اجرا کنید"
  echo "  (بالا چاپ شده‌اند؛ هر کدام باید 1 row affected بدهد)"
}

case "$MODE" in
  --status|status)
    report
    ;;
  --password|password)
    run_password
    ;;
  *)
    report force
    run_deploy
    report
    run_password
    head_ "پایان — کاری که فقط با مرورگر ممکن است"
    echo "  ۱) https://app.fitlytix.ir/api/db-test  → باید table_count بزرگ‌تر از صفر بدهد"
    echo "  ۲) وارد شوید و در صفحه بمانید (نه برگشت به فرم ورود)"
    echo "  ۳) /coach/data-quality را باز کنید (خالی بودن داده طبیعی است)"
    echo ""
    ;;
esac
