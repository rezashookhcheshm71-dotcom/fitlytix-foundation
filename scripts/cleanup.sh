#!/usr/bin/env bash
#
# پاک‌سازی پروسه‌های باقی‌مانده، برای وقتی بیلد با «Resource temporarily unavailable» می‌افتد.
#
#   bash scripts/cleanup.sh            # فقط گزارش
#   bash scripts/cleanup.sh --kill     # بستن نمونه‌های موقت روی پورت‌های ۳۹۷۰–۳۹۹۹
#
# چرا: اسکریپت‌های check-app / check-loop / daily-export یک نمونهٔ موقت روی پورت‌های
# ۳۹۸x بالا می‌آورند و در پایان می‌بندند؛ اگر اجرا وسط کار قطع شود (Ctrl+C، قطع SSH، خطا در
# اسکریپت)، آن نمونه زنده می‌ماند. چند نمونهٔ باقی‌مانده سقف `nproc` حساب cPanel را پر می‌کند و
# بیلد Rust/Vite با خطای «The global thread pool has not been initialized» می‌افتد.
#
# این اسکریپت فقط پروسه‌هایی را می‌بندد که روی آن پورت‌ها گوش می‌دهند — یعنی همان نمونه‌های
# موقت خودمان. پروسهٔ Passenger (که سایت را سرو می‌کند) دست‌نخورده می‌ماند.
set -uo pipefail

KILL=0
[ "${1:-}" = "--kill" ] && KILL=1

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

head_ "وضعیت منابع"
NODE_COUNT=$(pgrep -c node 2>/dev/null || echo 0)
info "پروسه‌های node: $NODE_COUNT"
[ -n "${NPROC_LIMIT:-}" ] || info "سقف پروسهٔ کاربر (ulimit -u): $(ulimit -u 2>/dev/null || echo "?")"
if command -v free >/dev/null; then
  info "حافظه: $(free -m | awk '/Mem:/ {printf "%.0f مگابایت آزاد از %.0f", $7, $2}')"
fi

# find listener pid on a port without requiring lsof
port_pid() {
  local port="$1" pid=""
  if command -v ss >/dev/null; then
    pid=$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $0}' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  elif command -v lsof >/dev/null; then
    pid=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | head -1)
  fi
  printf '%s' "$pid"
}

head_ "نمونه‌های موقت (پورت ۳۹۷۰–۳۹۹۹)"
FOUND=0
for port in $(seq 3970 3999); do
  pid=$(port_pid "$port")
  if [ -n "$pid" ]; then
    FOUND=$((FOUND + 1))
    CMD=$(ps -o cmd= -p "$pid" 2>/dev/null | cut -c1-60)
    bad "پورت $port → pid $pid ($CMD)"
    if [ "$KILL" = "1" ]; then
      kill "$pid" 2>/dev/null && ok "بسته شد: pid $pid" || bad "بستن ناموفق: pid $pid"
    fi
  fi
done
[ "$FOUND" -eq 0 ] && ok "هیچ نمونهٔ موقتی پیدا نشد"

head_ "نتیجه"
if [ "$FOUND" -gt 0 ] && [ "$KILL" = "0" ]; then
  echo "  برای بستن آن‌ها: bash scripts/cleanup.sh --kill"
  exit 1
fi
echo "  حالا دپلوی را دوباره بزنید:"
echo "     bash scripts/deploy-cpanel.sh --prune --low-mem"
echo ""
