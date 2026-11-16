#!/usr/bin/env bash
#
# پاک‌سازی پروسه‌های یتیم node، برای وقتی بیلد با «Resource temporarily unavailable» می‌افتد.
#
#   bash scripts/cleanup.sh            # فقط گزارش: هر پروسه node، عمر، حافظۀ مصرفی، تعداد ترد
#   bash scripts/cleanup.sh --kill     # بستن پروسه‌هایی که مال Passenger نیستند
#
# چرا: CloudLinux سقف تعداد پروسه/ترد را در سطح LVE اعمال می‌کند و `ulimit -u` آن را نشان
# نمی‌دهد. اسکریپت‌های check-app / check-loop / daily-export یک نمونهٔ موقت بالا می‌آورند و در
# پایان می‌بندند؛ اگر اجرا وسط کار قطع شود، نمونه زنده می‌ماند و سهمیهٔ ترد حساب را می‌خورد تا
# جایی که باندلر Rust/Vite با «The global thread pool has not been initialized» می‌افتد.
#
# تشخیص Passenger: پروسه‌ای که Passenger اجرا می‌کند در `/proc/<pid>/environ` متغیرهای
# PASSENGER_* دارد. همان‌ها هرگز بسته نمی‌شوند؛ بقیه (که خودمان ساخته‌ایم) یتیم حساب می‌شوند.
set -uo pipefail

KILL=0
[ "${1:-}" = "--kill" ] && KILL=1

ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

head_ "وضعیت کلی"
info "پروسه‌های node: $(pgrep -c node 2>/dev/null || echo 0)"
if command -v free >/dev/null; then
  info "حافظه: $(free -m | awk '/Mem:/ {printf "%.0f مگابایت آزاد از %.0f", $7, $2}')"
fi
info "توجه: سقف واقعی (LVE/nproc) با ulimit دیده نمی‌شود؛ پس به تعداد تردها نگاه کنید."

# cPanel's Passenger sets PASSENGER_* in the environment of the process it supervises.
is_passenger() { grep -qs "PASSENGER" "/proc/$1/environ" 2>/dev/null; }
threads_of() { awk '/^Threads:/ {print $2; exit}' "/proc/$1/status" 2>/dev/null; }
rss_mb() {
  local kb
  kb=$(awk '/^VmRSS:/ {print $2; exit}' "/proc/$1/status" 2>/dev/null)
  [ -n "${kb:-}" ] && printf '%s' "$((kb / 1024))" || printf '?'
}

head_ "پروسه‌های node"
ORPHANS=0
KEPT=0
for pid in $(pgrep -x node 2>/dev/null); do
  CMD=$(ps -o cmd= -p "$pid" 2>/dev/null | cut -c1-70)
  AGE=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
  TH=$(threads_of "$pid")
  RSS=$(rss_mb "$pid")

  if is_passenger "$pid"; then
    KEPT=$((KEPT + 1))
    ok "pid $pid · Passenger · ${AGE:-?} · ${TH:-?} ترد · ${RSS}MB"
    continue
  fi

  ORPHANS=$((ORPHANS + 1))
  bad "pid $pid · یتیم · ${AGE:-?} · ${TH:-?} ترد · ${RSS}MB"
  printf '     %s\n' "$CMD"
  if [ "$KILL" = "1" ]; then
    if kill "$pid" 2>/dev/null; then
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
      ok "بسته شد: pid $pid"
    else
      bad "بستن ناموفق: pid $pid (شاید مجوز کافی نیست)"
    fi
  fi
done

head_ "جمع‌بندی"
if [ "$ORPHANS" -eq 0 ]; then
  ok "هیچ پروسهٔ یتیمی نیست ($KEPT پروسهٔ Passenger دست‌نخورده)"
  echo ""
  echo "  پس علت خطای بیلد، سقف ترد/حافظهٔ LVE است. دپلوی کم‌مصرف را بزنید:"
  echo "     bash scripts/deploy-cpanel.sh --prune --low-mem"
elif [ "$KILL" = "1" ]; then
  ok "$ORPHANS پروسهٔ یتیم بسته شد"
  echo ""
  echo "  حالا دپلوی:"
  echo "     bash scripts/deploy-cpanel.sh --prune --low-mem"
else
  echo "  برای بستن آن‌ها:"
  echo "     bash scripts/cleanup.sh --kill"
  exit 1
fi
echo ""
