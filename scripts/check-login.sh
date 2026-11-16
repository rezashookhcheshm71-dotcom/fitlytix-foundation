#!/usr/bin/env bash
#
# «چرا وارد نمی‌شوم؟» — بدون حدس زدن.
#
#   bash scripts/check-login.sh
#
# چه می‌کند:
#   ۱) از دیتابیس می‌خواند: جدول users هست؟ چند کاربر؟ نقش/وضعیت/فرمت هش هر کاربر چیست؟
#   ۲) اگر ایمیل و رمز را وارد کنید، رمز را با همان قواعد verifyPassword() روی هشِ ذخیره‌شده
#      می‌سنجد و می‌گوید «رمز درست است» یا «نیست» — یعنی معلوم می‌شود مشکل رمز است یا نشست.
#   ۳) در پایان دقیقاً یک «اقدام بعدی» چاپ می‌کند.
#
# چرا bash و mysql CLI: بعد از --prune هیچ node_modules ای نیست (پس mysql2 در دسترس نیست)،
# ولی mysql CLI هاست و node همیشه هستند.
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/fitlytix-app}"
cd "$APP_DIR" 2>/dev/null || { echo "پوشهٔ اپ پیدا نشد: $APP_DIR"; exit 1; }

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --- credentials ------------------------------------------------------------
trim() { printf '%s' "$1" | tr -d '[:space:]'; }
# Read a value from .htaccess without tripping `set -e` when the file is missing.
ht() { grep -E "^SetEnv[[:space:]]+$1" .htaccess 2>/dev/null | awk '{print $3}' || true; }
DB_NAME="$(trim "${DB_NAME:-$(ht DB_NAME)}")"
DB_USER="$(trim "${DB_USER:-$(ht DB_USER)}")"
DB_PASSWORD="${DB_PASSWORD:-$(ht DB_PASSWORD)}"

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  bad "اعتبارنامهٔ دیتابیس در .htaccess پیدا نشد"
  echo "  دستورهای زیر را در phpMyAdmin → تب SQL اجرا کنید و خروجی را بفرستید:"
  echo "  SELECT email, role, status, LEFT(password_hash, 7), LENGTH(password_hash) FROM users;"
  exit 1
fi

MYSQL_BIN="$(command -v mysql || true)"
if [ -z "$MYSQL_BIN" ]; then
  bad "دستور mysql روی این هاست نیست"
  echo "  همین کوئری‌ها را در phpMyAdmin → تب SQL اجرا کنید و خروجی را بفرستید:"
  echo "  SELECT email, role, status, LEFT(password_hash, 7) AS prefix, LENGTH(password_hash) AS len FROM users;"
  echo "  SELECT COUNT(*) AS sessions FROM user_sessions;"
  exit 1
fi

q() { MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" -h "${DB_HOST:-localhost}" -u "$DB_USER" -D "$DB_NAME" -N -B -e "$1" 2>&1; }

head_ "۱) اتصال و جدول‌ها"
if ! q "SELECT 1" | grep -qx 1; then
  bad "اتصال به دیتابیس برقرار نشد"
  q "SELECT 1" | sed 's/^/     /'
  exit 1
fi
ok "اتصال به دیتابیس برقرار است"

USER_TABLE=$(q "SHOW TABLES LIKE 'users'")
if [ -z "$USER_TABLE" ]; then
  bad "جدول users وجود ندارد → مهاجرت ۰۰۲ اجرا نشده"
  echo "  اقدام: migration 002 را در phpMyAdmin اجرا کنید."
  exit 1
fi
ok "جدول users موجود است"

SESSION_TABLE=$(q "SHOW TABLES LIKE 'user_sessions'")
if [ -n "$SESSION_TABLE" ]; then
  ok "جدول user_sessions موجود است ($(q "SELECT COUNT(*) FROM user_sessions" | tr -d '[:space:]') ردیف)"
else
  bad "جدول user_sessions نیست → ورود هرگز پایدار نمی‌ماند (مهاجرت ۰۰۲)"
fi

head_ "۲) کاربران"
TOTAL=$(q "SELECT COUNT(*) FROM users" | tr -d '[:space:]')
if [ "${TOTAL:-0}" -eq 0 ]; then
  bad "هیچ کاربری در جدول users نیست"
  echo "  اقدام: از صفحهٔ /register یک حساب بسازید، بعد این اسکریپت را دوباره اجرا کنید."
  exit 1
fi
ok "$TOTAL کاربر ثبت شده است"

ROWS=$(q "SELECT CONCAT(email, ' | ', COALESCE(role,'-'), ' | ', COALESCE(status,'-'), ' | ', LEFT(password_hash,7), ' | ', LENGTH(password_hash)) FROM users ORDER BY created_at DESC LIMIT 10")
printf '%s\n' "$ROWS" | while IFS= read -r line; do printf '     %s\n' "$line"; done

# --- verdict on format ------------------------------------------------------
FIRST_PREFIX=$(printf '%s\n' "$ROWS" | head -1 | awk -F' \\| ' '{print $4}')
if printf '%s\n' "$ROWS" | awk -F' \\| ' '{print $4}' | grep -qv '^scrypt\$'; then
  info "برخی حساب‌ها هش غیر scrypt دارند (مثل \$2y\$ یا خالی) → آن‌ها هرگز نمی‌توانند وارد شوند"
fi

head_ "۳) آزمون رمز (اختیاری اما تعیین‌کننده)"
printf '  ایمیل حساب را وارد کنید (خالی = رد شدن): '
read -r EMAIL
if [ -z "${EMAIL:-}" ]; then
  info "آزمون رمز رد شد"
  head_ "اقدام بعدی"
  echo "  اگر وارد نمی‌شوید: bash scripts/finish-setup.sh --password"
  exit 0
fi
printf '  رمز عبور (تایپ نمی‌شود): '
read -r -s PASSWORD
printf '\n'

EMAIL_LOWER=$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]' | sed "s/'/''/g")
HASH=$(q "SELECT password_hash FROM users WHERE LOWER(email) = '$EMAIL_LOWER' LIMIT 1" | tr -d '\r')

if [ -z "$HASH" ] || printf '%s' "$HASH" | grep -qi '^ERROR'; then
  bad "حسابی با این ایمیل در دیتابیس نیست"
  head_ "اقدام بعدی"
  echo "  با همین ایمیل ثبت‌نام کنید (/register) یا ایمیل را دقیق بررسی کنید."
  exit 0
fi

VERDICT=$(HASH="$HASH" PASS="$PASSWORD" node -e '
const crypto = require("node:crypto");
const h = process.env.HASH || "";
const p = process.env.PASS || "";
let ok = false;
try {
  if (h.startsWith("scrypt$")) {
    const [, salt, hex] = h.split("$");
    const expected = Buffer.from(hex, "hex");
    const actual = crypto.scryptSync(p, salt, expected.length);
    ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } else if (/^[a-f0-9]{64}$/i.test(h)) {
    const expected = Buffer.from(h, "hex");
    const actual = crypto.createHash("sha256").update(p).digest();
    ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } else if (h.includes(":") && !h.startsWith("$2")) {
    const [salt, hex] = h.split(":");
    const expected = Buffer.from(hex, "hex");
    const actual = crypto.scryptSync(p, salt, expected.length);
    ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
} catch {
  ok = false;
}
process.stdout.write(ok ? "MATCH" : "NO_MATCH");
' 2>/dev/null)

head_ "نتیجه"
if [ "$VERDICT" = "MATCH" ]; then
  ok "رمز شما با هشِ ذخیره‌شده مطابقت دارد"
  info "پس ۴۰۱ گرفتن از رمز نیست؛ مشکل در ثبت نشست یا خواندن آن است."
  head_ "اقدام بعدی"
  echo "  در مرورگر: https://app.fitlytix.ir/api/auth/me"
  echo "  اگر {\"authenticated\":false} داد، این را اجرا کنید: tail -40 logs/passenger.log"
  echo "  و خروجی را بفرستید."
else
  bad "رمز شما با هشِ ذخیره‌شده مطابقت ندارد"
  info "علت رایج: هش قدیمی (غیر scrypt) یا رمزی که بعد از ثبت‌نام عوض شده."
  head_ "اقدام بعدی"
  echo "  bash scripts/finish-setup.sh --password"
  echo "  سپس دو خط SQL چاپ‌شده را در phpMyAdmin → تب SQL اجرا کنید (هر کدام 1 row affected)."
fi
echo ""
