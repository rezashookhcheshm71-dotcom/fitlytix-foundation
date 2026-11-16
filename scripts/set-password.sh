#!/usr/bin/env bash
#
# رمز (و اگر بخواهید نقش) یک حساب را مستقیم در دیتابیس می‌نشاند — بدون phpMyAdmin.
#
#   bash scripts/set-password.sh                 # ایمیل و رمز را تعاملی می‌پرسد
#   bash scripts/set-password.sh --role coach
#
# چرا: پیام «ایمیل یا رمز عبور صحیح نیست» هم برای «ایمیل ناموجود» و هم برای «هش ناشناخته» می‌آید،
# و رفعش تا حالا به پیست‌کردن SQL در phpMyAdmin وابسته بود. این اسکریپت:
#   ۱) بررسی می‌کند ایمیل در جدول users هست یا نه (اگر نبود، صریح می‌گوید ثبت‌نام کنید)،
#   ۲) هش scrypt می‌سازد و با UPDATE می‌نشاند،
#   ۳) بعد از نوشتن، هش را از دیتابیس می‌خواند و رمز را با همان قواعد verifyPassword() می‌سنجد.
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
WANT_ROLE="${2:-}"
[ "${1:-}" = "--role" ] && WANT_ROLE="${2:-coach}"

cd "$APP_DIR" 2>/dev/null || { echo "پوشهٔ اپ پیدا نشد: $APP_DIR"; exit 1; }

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

trim() { printf '%s' "$1" | tr -d '[:space:]'; }
# Read a value from .htaccess without tripping `set -e` when the file is missing.
ht() { grep -E "^SetEnv[[:space:]]+$1" .htaccess 2>/dev/null | awk '{print $3}' || true; }
DB_NAME="$(trim "${DB_NAME:-$(ht DB_NAME)}")"
DB_USER="$(trim "${DB_USER:-$(ht DB_USER)}")"
DB_PASSWORD="${DB_PASSWORD:-$(ht DB_PASSWORD)}"
DB_HOST="${DB_HOST:-localhost}"

MYSQL_BIN="$(command -v mysql || true)"
if [ -z "$MYSQL_BIN" ]; then
  bad "دستور mysql روی این هاست نیست — ناچار باید از phpMyAdmin استفاده کنیم"
  echo "  bash scripts/finish-setup.sh --password   # همان SQL را چاپ می‌کند"
  exit 1
fi
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  bad "اعتبارنامهٔ دیتابیس در .htaccess پیدا نشد"
  exit 1
fi

q() { MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" -h "$DB_HOST" -u "$DB_USER" -D "$DB_NAME" -N -B -e "$1" 2>&1; }
esc() { printf '%s' "$1" | sed "s/'/''/g"; }

head_ "کدام حساب؟"
printf '  ایمیل: '
read -r EMAIL
EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[ -z "$EMAIL" ] && { bad "ایمیل خالی است"; exit 1; }
E=$(esc "$EMAIL")

if ! q "SELECT 1" | grep -qx 1; then
  bad "اتصال به دیتابیس برقرار نشد:"
  q "SELECT 1" | sed 's/^/     /'
  exit 1
fi

EXISTING=$(q "SELECT CONCAT(COALESCE(role,'-'), '|', COALESCE(status,'-'), '|', LEFT(password_hash,7), '|', LENGTH(password_hash)) FROM users WHERE LOWER(email) = '$E' LIMIT 1")
if [ -z "$EXISTING" ]; then
  bad "حسابی با این ایمیل در دیتابیس نیست"
  info "این رایج‌ترین علت است: ثبت‌نام انجام شده ولی ردیفی ذخیره نشده (مثلاً دیتابیس وصل نبوده)."
  head_ "اقدام بعدی"
  echo "  ۱) در مرورگر /register را باز کنید و با همین ایمیل ثبت‌نام کنید"
  echo "  ۲) بعد این اسکریپت را دوباره اجرا کنید (یا مستقیم وارد شوید)"
  exit 0
fi
ok "حساب پیدا شد: role|status|hash|len = $EXISTING"

head_ "رمز جدید"
printf '  رمز عبور (تایپ نمی‌شود): '
read -r -s PASSWORD
printf '\n'
if [ "${#PASSWORD}" -lt 6 ]; then
  bad "رمز باید حداقل ۶ کاراکتر باشد (اپ همین را قبول می‌کند)"
  exit 1
fi

HASH=$(PASS="$PASSWORD" node -e '
const crypto = require("node:crypto");
const password = process.env.PASS || "";
const salt = crypto.randomBytes(16).toString("hex");
process.stdout.write(`scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`);
')
if [ -z "$HASH" ]; then
  bad "ساخت هش ناموفق بود"
  exit 1
fi

head_ "نوشتن در دیتابیس"
q "UPDATE users SET password_hash = '$HASH' WHERE LOWER(email) = '$E'" >/dev/null
STORED=$(q "SELECT CONCAT(LEFT(password_hash,7), '|', LENGTH(password_hash)) FROM users WHERE LOWER(email) = '$E' LIMIT 1")
if [ "$STORED" = "scrypt\$|168" ]; then
  ok "هش scrypt با طول ۱۶۸ ذخیره شد"
else
  bad "هش ذخیره‌شده انتظار ما را برآورده نمی‌کند: $STORED"
  info "اگر ستون password_hash کوتاه‌تر از ۱۶۸ است، مهاجرت ۰۰۷ اجرا نشده."
  exit 1
fi

if [ -n "$WANT_ROLE" ]; then
  HAS_ROLE=$(q "SHOW COLUMNS FROM users LIKE 'role'")
  if [ -z "$HAS_ROLE" ]; then
    bad "ستون role وجود ندارد → مهاجرت ۰۰۷ اجرا نشده؛ نقش تنظیم نشد"
  else
    q "UPDATE users SET role = '$(esc "$WANT_ROLE")' WHERE LOWER(email) = '$E'" >/dev/null
    NOW_ROLE=$(q "SELECT role FROM users WHERE LOWER(email) = '$E' LIMIT 1")
    ok "نقش به '$NOW_ROLE' تنظیم شد"
  fi
fi

head_ "تأیید نهایی (رمزی که همین حالا نوشتیم را دوباره می‌سنجیم)"
VERDICT=$(HASH="$(q "SELECT password_hash FROM users WHERE LOWER(email) = '$E' LIMIT 1")" PASS="$PASSWORD" node -e '
const crypto = require("node:crypto");
const h = process.env.HASH || "", p = process.env.PASS || "";
try {
  const [, salt, hex] = h.split("$");
  const expected = Buffer.from(hex, "hex");
  const actual = crypto.scryptSync(p, salt, expected.length);
  process.stdout.write(expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? "MATCH" : "NO_MATCH");
} catch { process.stdout.write("NO_MATCH"); }
')
if [ "$VERDICT" = "MATCH" ]; then
  ok "رمز جدید در دیتابیس با قواعد اپ مطابقت دارد"
  head_ "حالا"
  echo "  در مرورگر وارد شوید با همین ایمیل و همین رمز."
  echo "  اگر باز «ایمیل یا رمز عبور صحیح نیست» داد:"
  echo "     bash scripts/check-login.sh    # نشان می‌دهد اپ کدام دیتابیس/کاربر را می‌بیند"
else
  bad "رمز ذخیره‌شده با رمز واردشده مطابقت ندارد — این نباید رخ دهد"
  echo "  این خروجی را بفرستید (بدون رمز)."
fi
echo ""
