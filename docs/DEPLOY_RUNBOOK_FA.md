# کتابچهٔ یکپارچهٔ دپلوی و صحت‌سنجی FitLytix (cPanel / nphost3)

> این سند **تنها مرجع** برای بردن نسخهٔ جدید روی سرور، اجرای مهاجرت‌ها، تأیید فنی و
> صحت‌سنجی ورزشی است. از بالا به پایین اجرا شود.
>
> وضعیت فعلی (پس از این دپلوی): دیتابیس وصل است، ثبت‌نام کار می‌کند، ارزیابی → برنامه →
> ذخیره در `recommendation_snapshots` → نمایش در `/athlete/program` سالم است، و تست
> end-to-end با **۱۴ از ۱۴** بررسی موفق پاس شده است.

---

## ۰) نقشهٔ کلی مسیر

```
کاربر → /assessment/common + /assessment/sport
      → POST /api/assessment  (ذخیرهٔ پاسخ‌ها در MySQL)
      → refreshPlanForUser()   (مدل درون‌فرآیندی TS، بدون سرویس پایتون)
      → recommendation_snapshots  (متن + ورودی‌ها + نسخهٔ مدل)
      → GET /api/plan  (از اسنپشات؛ در صورت نبود → محاسبهٔ درجا)
      → /athlete/program + /athlete/dashboard  (جای دادهٔ نمایشی)
```

اجزای کلیدی:

| لایه                | مسیر                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| موتور توصیه         | `src/services/recommendation/` (ensemble + guardrails + archetypes + nutrition + explain) |
| آرتیفکت مدل         | `src/services/recommendation/model/model.json` (نسخهٔ `2026.11.11-cce631a`)               |
| اتصال به دیتابیس    | `src/lib/db.server.ts`                                                                    |
| API                 | `/api/assessment`, `/api/plan`, `/api/plan-diagnose`, `/api/db-test`, `/api/auth/*`       |
| اسنپشات             | `src/services/recommendation/snapshots.server.ts` + مهاجرت‌های ۰۰۴/۰۰۵                    |
| سیاست انتخاب برنامه | `src/services/recommendation/userPlan.server.ts`                                          |

---

## ۱) پیش‌نیازها و مسیرهای ثابت

| مورد                  | مقدار                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| ریشهٔ اپ              | `~/public_html/fitlytix-app`                                                |
| محیط Node             | `source ~/nodevenv/public_html/fitlytix-app/22/bin/activate` (Node 22.23.4) |
| فایل استارت Passenger | `.output/server/index.mjs` (در `.htaccess`)                                 |
| متغیرهای محیطی        | بلوک `SetEnv` در `.htaccess` + پشتیبان `~/fitlytix.env`                     |
| دیتابیس               | `eugtezmj_fitlytix` روی `localhost`، کاربر `eugtezmj_fitlytix`              |
| شاخهٔ کد              | `arena/9adac5a4-fitlytix-foundation`                                        |

**قاعدهٔ طلایی paste:** هر دستور را **یک‌خطی** اجرا کنید. اگر در ترمینال `^[[200~` دیدید،
یعنی bracketed paste خراب شده: `stty sane` بعد `reset` و همان خط را دوباره بزنید.

---

## ۲) دپلوی با یک دستور (توصیه‌شده)

اسکریپت `scripts/deploy-cpanel.sh` همهٔ مراحل را امن انجام می‌دهد (پشتیبان → دریافت کد →
`npm ci` با devDeps → بیلد با تنظیمات Rayon → مهاجرت ۰۰۴/۰۰۵ → ری‌استارت Passenger).

**گام الف — فقط خود اسکریپت را بگیرید و اجرا کنید (یک خط):**

```sh
cd ~/public_html/fitlytix-app && curl -fL -o /tmp/app.tar.gz https://codeload.github.com/rezashookhcheshm71-dotcom/fitlytix-foundation/tar.gz/refs/heads/arena/9adac5a4-fitlytix-foundation && tar -xzf /tmp/app.tar.gz -C /tmp --strip-components=1 --wildcards '*/scripts/deploy-cpanel.sh' && bash /tmp/scripts/deploy-cpanel.sh --with-migrations
```

اگر می‌خواهید اول ببینید چه می‌کند:

```sh
bash /tmp/scripts/deploy-cpanel.sh --dry-run --with-migrations
```

گزینه‌ها: `--with-migrations` (اجرای SQL)، `--no-backup`، `--dry-run`.

اسکریپت این کارها را **نمی‌کند**: دست‌زدن به `.htaccess`، حذف `.output` قبل از بیلد موفق،
یا حذف `node_modules`.

---

## ۳) همان مسیر، دستی (برای وقتی که اسکریپت را نمی‌خواهید)

### گام ۱ — پشتیبان

```sh
mkdir -p ~/deploy-backups && tar --exclude=node_modules --exclude=.output -czf ~/deploy-backups/app-$(date +%F-%H%M).tgz -C ~/public_html fitlytix-app
```

### گام ۲ — دریافت کد

```sh
cd ~/public_html/fitlytix-app && curl -fL -o /tmp/app.tar.gz https://codeload.github.com/rezashookhcheshm71-dotcom/fitlytix-foundation/tar.gz/refs/heads/arena/9adac5a4-fitlytix-foundation
```

```sh
tar -xzf /tmp/app.tar.gz -C ~/public_html/fitlytix-app --strip-components=1
```

`.htaccess`، `tmp/` و `.output` دست‌نخورده می‌مانند.

### گام ۳ — وابستگی‌ها

```sh
source ~/nodevenv/public_html/fitlytix-app/22/bin/activate
```

```sh
cd ~/public_html/fitlytix-app && npm_config_omit= npm ci --include=dev
```

> `npm_config_omit=` اجباری است: کانفیگ این هاست `omit=dev` دارد و بدون آن `vite`/`nitro`
> نصب نمی‌شوند و بیلد با `ERR_MODULE_NOT_FOUND` می‌شکند.

### گام ۴ — بیلد

```sh
cd ~/public_html/fitlytix-app && RAYON_NUM_THREADS=1 RAYON_RS_NUM_CPUS=1 UV_THREADPOOL_SIZE=2 NODE_OPTIONS=--max-old-space-size=1536 npm run build
```

> پنیک `Rolldown/Rayon` فقط با همین متغیرها رخ نمی‌دهد. خروجی موفق: `.output/server/index.mjs`
> بازنویسی می‌شود.

### گام ۵ — ری‌استارت

```sh
touch ~/public_html/fitlytix-app/tmp/restart.txt
```

---

## ۴) مهاجرت‌های دیتابیس

### وضعیت

| مهاجرت                       | وضعیت            | نکته                                                                             |
| ---------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| 001 training core            | ✅               | —                                                                                |
| 002 auth/assessment          | ✅               | `body_analysis_records` و `health_metrics` به‌صورت دستی و **بدون FK** ساخته شدند |
| 003 recommendation engine    | ✅               | —                                                                                |
| 004 recommendation snapshots | ✅               | بدون FK (خطای `#3780`)                                                           |
| **005 snapshot seq**         | ⬜ اگر اجرا نشده | مرتب‌سازی قطعی اسنپشات‌ها                                                        |
| **006 data loop**            | ⬜ اگر اجرا نشده | `athlete_checkins` + ستون‌های برچسب نتیجه در `recommendation_outcomes`           |

### چرا ۰۰۵ مهم است (نکتهٔ ورزشی/محصولی)

هر ارسال ارزیابی، برنامه را بازسازی می‌کند؛ پس ارزیابی عمومی و ارزیابی رشته دو اسنپشات را
در **همان ثانیه** می‌نویسند. با `created_at` (دقت ثانیه) انتخاب «آخرین برنامه» تصادفی بود و
ممکن بود ورزشکار برنامهٔ عمومی `cf_foundation` (اعتماد `medium`) را جای برنامهٔ اختصاصی
`cf_strength_skill` ببیند. ستون `seq` این ابهام را حذف می‌کند.

### اجرا (phpMyAdmin → دیتابیس `eugtezmj_fitlytix` → تب SQL)

```sql
ALTER TABLE recommendation_snapshots ADD COLUMN seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD KEY idx_snapshot_seq (seq);
```

```sql
CREATE OR REPLACE VIEW v_latest_recommendation AS SELECT s.* FROM recommendation_snapshots s JOIN (SELECT user_id, MAX(seq) AS seq FROM recommendation_snapshots GROUP BY user_id) latest ON latest.user_id = s.user_id AND latest.seq = s.seq;
```

> خطای `Duplicate column name 'seq'` = قبلاً اجرا شده؛ رد شوید.

### مهاجرت ۰۰۶ — حلقهٔ داده (توضیح کامل در `docs/DATA_LOOP_FA.md`)

```sql
CREATE TABLE IF NOT EXISTS athlete_checkins (id CHAR(36) NOT NULL PRIMARY KEY, athlete_user_id CHAR(36) NOT NULL, checkin_date DATE NOT NULL, sleep_hours DECIMAL(4,2) NULL, sleep_quality TINYINT UNSIGNED NULL, stress TINYINT UNSIGNED NULL, readiness TINYINT UNSIGNED NULL, weight_kg DECIMAL(5,2) NULL, resting_hr SMALLINT UNSIGNED NULL, notes VARCHAR(500) NULL, source VARCHAR(24) NOT NULL DEFAULT 'manual', data_origin VARCHAR(20) NOT NULL DEFAULT 'live', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_checkin_user_date (athlete_user_id, checkin_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

```sql
ALTER TABLE recommendation_outcomes ADD COLUMN snapshot_id CHAR(36) NULL, ADD COLUMN window_days SMALLINT UNSIGNED NULL, ADD COLUMN nutrition_adherence DECIMAL(4,3) NULL, ADD COLUMN avg_rpe DECIMAL(4,1) NULL, ADD COLUMN label_source VARCHAR(24) NOT NULL DEFAULT 'auto', ADD UNIQUE KEY uq_outcome_snapshot (snapshot_id);
```

> خطای `Duplicate column name` = قبلاً اجرا شده.

---

## ۵) تنظیمات محیط (env) و Passenger

### ۵.۱ حالت فعلی (کار می‌کند — تغییر ندهید)

`.htaccess` شامل بلوک `SetEnv` است و **باید تک‌فاصله** باشد:

```apache
SetEnv DB_HOST localhost
SetEnv DB_PORT 3306
SetEnv DB_NAME eugtezmj_fitlytix
SetEnv DB_USER eugtezmj_fitlytix
SetEnv DB_PASSWORD <رمز واقعی>
SetEnv SESSION_SECRET <۳۲+ کاراکتر تصادفی>
SetEnv NODE_ENV production
```

بررسی بدون دیدن رمز:

```sh
grep -nE "SetEnv DB_|PassengerStartupFile" ~/public_html/fitlytix-app/.htaccess | cat -A
```

انتظار: `SetEnv DB_USER eugtezmj_fitlytix$` (بدون فاصلهٔ اضافه، بدون `^M`).

### ۵.۲ حالت پشتیبان (اگر روزی `DB_NOT_CONFIGURED` دیدید)

`app.js` جدید خودش متغیرها را از فایل می‌خواند:

1. فایل `~/fitlytix.env` بسازید (با File Manager و **تایپ دستی**، نه paste):

```
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_NAME=eugtezmj_fitlytix
DB_USER=eugtezmj_fitlytix
DB_PASSWORD=<رمز واقعی>
SESSION_SECRET=<۳۲+ کاراکتر>
```

2. محدود کردن دسترسی:

```sh
chmod 600 ~/fitlytix.env
```

3. سوییچ استارت‌فایل:

```sh
sed -i 's#^PassengerStartupFile .*#PassengerStartupFile app.js#' ~/public_html/fitlytix-app/.htaccess
```

4. ری‌استارت: `touch ~/public_html/fitlytix-app/tmp/restart.txt`

### ۵.۳ متغیرهای مفید دیگر

| متغیر            | کاربرد                                          | پیش‌فرض    |
| ---------------- | ----------------------------------------------- | ---------- |
| `DB_POOL_SIZE`   | تعداد اتصال همزمان MySQL هر پروسه               | ۳ (سقف ۲۰) |
| `DB_SOCKET`      | مسیر سوکت یونیکس وقتی TCP 3306 بسته است         | خالی       |
| `FITLYTIX_DEBUG` | `1` = برگرداندن جزئیات خطای SQL در پاسخ ثبت‌نام | خالی       |

---

## ۶) تأیید فنی (از مرورگر، نه curl روی سرور)

> `curl` از سرور به دامنهٔ خودش `000` می‌دهد (بدون hairpin egress)؛ این خرابی سایت نیست.

| آدرس                                  | انتظار                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `https://app.fitlytix.ir/api/health`  | `{"ok":true,"service":"fitlytix","environment":"production"}`                  |
| `https://app.fitlytix.ir/api/db-test` | `{"ok":true,"rows":[{"db":"eugtezmj_fitlytix","table_count":56}],"env":{...}}` |
| `https://app.fitlytix.ir/register`    | فرم ثبت‌نام                                                                    |
| پس از ورود: `/api/plan-diagnose`      | `migrations` شامل `005` = `true`، `storedSnapshot` پر                          |
| `/athlete/program`                    | برنامهٔ مدل (نه دادهٔ نمایشی)                                                  |
| `/athlete/dashboard`                  | همان برنامه + تغذیه + مربیگری                                                  |

بررسی دیتابیس از ترمینال (یک‌خطی، بدون نقطه‌های مشکل‌ساز در چت):

```sh
mysql -u eugtezmj_fitlytix -p'<رمز>' eugtezmj_fitlytix -e "SELECT sport, archetype_id, duration_months, nutrition_strategy_id, coaching_mode, safety_level, confidence, model_version, created_at FROM recommendation_snapshots ORDER BY created_at DESC LIMIT 8;"
```

---

## ۷) تست خودکار end-to-end (۱۴ بررسی)

روی سرور، دامنهٔ خودش قابل دسترسی نیست؛ پس یک نمونهٔ موقت روی پورت ۳۹۹۹ بالا بیاورید:

```sh
cd ~/public_html/fitlytix-app && nohup env DB_HOST=localhost DB_NAME=eugtezmj_fitlytix DB_USER=eugtezmj_fitlytix DB_PASSWORD='<رمز>' SESSION_SECRET=e2e-secret PORT=3999 node .output/server/index.mjs > /tmp/e2e-server.log 2>&1 & echo $! > /tmp/e2e.pid
```

```sh
sleep 4; curl -s http://127.0.0.1:3999/api/health; echo
```

```sh
cd ~/public_html/fitlytix-app && E2E_BASE_URL=http://127.0.0.1:3999 E2E_EMAIL=e2e-$(date +%H%M)@example.com E2E_PASSWORD=Test1234x E2E_REGISTER=1 E2E_SPORT=crossfit node scripts/e2e-plan.mjs; echo "exit=$?"
```

بستن نمونهٔ موقت (اگر `Too many connections` دیدید همین کار لازم است):

```sh
pkill -f "PORT=3999" 2>/dev/null; ps -eo pid,cmd | grep "[.]output/server/index.mjs"; echo done
```

اگر خطی چاپ شد، همان PID را با `kill <PID>` ببندید (اپ اصلی زیر Passenger دوباره بالا می‌آید).

**خروجی موفق:**

```
✓ POST /api/auth/register — HTTP 201
✓ برنامه پس از ارزیابی خودکار ساخته شد
✓ برنامه در دیتابیس ذخیره شد (migration 004) — snapshot=…
✓ همهٔ جداول لازم موجودند
14/14 بررسی موفق
```

---

## ۸) صحت‌سنجی ورزشی (چه چیزی درست است؟)

### ۸.۱ چهارچوب برنامه

| مفهوم       | مقادیر مجاز                                                                              |
| ----------- | ---------------------------------------------------------------------------------------- |
| دوره        | ۱ / ۳ / ۶ / ۱۲ ماه                                                                       |
| جلسات       | از الگوی آرکیتایپ، محدود به زمان در دسترس ورزشکار و سقف‌های ایمنی (**پیش‌فرض حداکثر ۶**) |
| ساختار جلسه | گرم‌کردن ۱۰ دقیقه + بلوک اصلی ~۵۰ دقیقه + سردکردن ۸ دقیقه = **۶۸ دقیقه**                 |
| تغذیه       | `fat_loss_deficit`, `lean_gain`, `performance_fuel`, `maintenance`, `recomp`             |
| مربیگری     | `ai`, `hybrid`, `human`                                                                  |
| سطح ایمنی   | `none`, `caution`, `review_required`                                                     |
| بسته        | پیش‌فرض `combined`                                                                       |

### ۸.۲ آرکیتایپ‌ها (۲۰ مورد)

| رشته     | آرکیتایپ‌ها                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------- |
| کراسفیت  | `cf_foundation`, `cf_strength_skill`, `cf_engine_competition`, `cf_balanced_performance`       |
| هایروکس  | `hx_base_engine`, `hx_station_strength`, `hx_race_prep`, `hx_hybrid_maintenance`               |
| فانکشنال | `fn_movement_foundation`, `fn_strength_balance`, `fn_conditioning_gpp`, `fn_mobility_recovery` |
| بدنسازی  | `bb_full_body_foundation`, `bb_upper_lower`, `bb_push_pull_legs`, `bb_weak_point`              |
| دویدن    | `rn_base_build`, `rn_threshold_5k10k`, `rn_half_marathon`, `rn_speed_maintenance`              |

هر آرکیتایپ یک هفتهٔ کامل با حرکت‌های اصلی، بلوک‌های WOD/engine/skill و یادداشت پیشرفت +
دیلود هر ۴ هفته دارد (`src/services/recommendation/archetypes.ts`).

### ۸.۳ سناریوی مرجع (باید عیناً بازتولید شود)

ورودی: کراسفیت، سطح متوسط، ۳ جلسه در هفته، خواب ۷.۵ ساعت، استرس ۲/۵، بدون درد، BMI نرمال.

| خروجی    | مقدار انتظاری             |
| -------- | ------------------------- |
| آرکیتایپ | `cf_strength_skill`       |
| دوره     | ۶ ماه                     |
| جلسات    | ۳ (بر اساس زمان در دسترس) |
| مدت جلسه | ۶۸ دقیقه                  |
| تغذیه    | `recomp`                  |
| مربیگری  | `ai`                      |
| ایمنی    | `none`                    |
| اعتماد   | `high`                    |

### ۸.۴ گاردریل‌ها (قواعد ایمنی که مدل را محدود می‌کنند)

| شرط                             | اثر روی برنامه                                            | پرچم                     |
| ------------------------------- | --------------------------------------------------------- | ------------------------ |
| درد ≥ ۳/۱۰                      | آرکیتایپ کم‌فشار، ≤۳ جلسه، ≤۳ ماه، مربی `human`           | `pain_clinician_limited` |
| درد ۱.۶–۳                       | آرکیتایپ پربرخورد عوض می‌شود، یک جلسه کم، مربی ≥ `hybrid` | `pain_reported`          |
| خواب < ۶ ساعت                   | یک جلسه کم (حداقل ۲)                                      | `low_sleep`              |
| استرس ≥ ۵/۵                     | یک جلسه کم                                                | `high_stress`            |
| آمادگی < ۵۰                     | یک جلسه کم                                                | `low_readiness`          |
| پایبندی ۲۸ روز < ۵۰٪            | دوره = ۱ ماه، مربی ≥ `hybrid`                             | `low_adherence`          |
| BMI < ۱۸.۵ با هدف کاهش/ریکامپ   | تغذیه → `lean_gain`                                       | `underweight`            |
| چربی < ۸٪ با `fat_loss_deficit` | تغذیه → `recomp`                                          | `nutrition_risk`         |
| سن < ۱۶                         | ≤۳ جلسه، ≤۳ ماه، `human`                                  | `minor_athlete`          |
| سقف انتخابی کاربر               | جلسات به آن محدود می‌شود                                  | `high_volume_cap`        |

**آزمون‌های دستی پیشنهادی:** یک ارزیابی با درد ۸/۱۰، یکی با خواب ۵ ساعت، یکی با BMI ۱۷.۵
و هدف کاهش وزن. سپس در `/athlete/program` و جدول اسنپشات بررسی کنید که سقف‌ها اعمال شده‌اند.

### ۸.۵ انتظار ورزشی از هر رشته

- **کراسفیت:** تعادل strength/skill/engine؛ WODهای مقیاس‌شده؛ هفتهٔ دیلود هر ۴ هفته.
- **هایروکس:** تمرکز روی ایستگاه‌ها (sled، burpee، wall ball) و اقتصاد دویدن؛ `hx_race_prep` فقط نزدیک مسابقه.
- **فانکشنال:** الگوهای پایه، تعادل، آمادگی عمومی (GPP)، تحرک/ریکاوری.
- **بدنسازی:** تقسیم‌بندی حجم/فرکانس منطقی؛ `bb_weak_point` فقط با سابقهٔ تمرین کافی.
- **دویدن:** حجم پایه قبل از شدت؛ `rn_half_marathon` با ۱۲ هفته به بالا معنا دارد.

---

## ۹) برگشت سریع (rollback)

```sh
cd ~/public_html && tar -xzf ~/deploy-backups/app-<stamp>.tgz
```

```sh
touch ~/public_html/fitlytix-app/tmp/restart.txt
```

پوشهٔ قدیمی هم موجود است: `~/public_html/fitlytix-app.bak.2026-11-11-1544`.

---

## ۱۰) عیب‌یابی (همهٔ مواردی که واقعاً رخ داد)

| نشانه                                        | علت واقعی                                    | راه‌حل                                                         |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| 403 روی کل سایت                              | `.htaccess` در ریشهٔ اپ گم شده بود           | بازگردانی از `.bak` + `sed` مسیرها + `tmp/restart.txt`         |
| ۵۰۰ «خطا در ثبت‌نام…»                        | `Too many connections` (نه رمز!)             | بستن نمونه‌های موقت + `DB_POOL_SIZE=3`                         |
| `Access denied for user ' user'@'localhost'` | فاصلهٔ نامرئی در مقدار `DB_*`                | `trim()` در کد + تک‌فاصله در `.htaccess`                       |
| `DB_NOT_CONFIGURED` / `DB_*` همه `false`     | `SetEnv` به اپ نرسیده                        | `~/fitlytix.env` + `PassengerStartupFile app.js`               |
| `ECONNREFUSED 127.0.0.1:3306`                | TCP بسته                                     | `DB_HOST=localhost` یا `DB_SOCKET=/var/lib/mysql/mysql.sock`   |
| `ER_ACCESS_DENIED_ERROR` بدون فاصله          | رمز عوض شده                                  | ریست رمز در cPanel + به‌روزرسانی `.htaccess`                   |
| بیلد `Rolldown/Rayon panic`                  | thread pool                                  | `RAYON_NUM_THREADS=1 RAYON_RS_NUM_CPUS=1 UV_THREADPOOL_SIZE=2` |
| `ERR_MODULE_NOT_FOUND vite`                  | devDeps نصب نشده‌اند                         | `npm_config_omit= npm ci --include=dev`                        |
| خطای `#3780` هنگام مهاجرت                    | ناسازگاری FK/کولیشن                          | بدون FK بسازید (۰۰۴/۰۰۲)                                       |
| `400` ارزیابی عمومی                          | نبود `measuredAt`/`source` در `bodyAnalysis` | در payload بفرستید                                             |
| برنامهٔ عمومی جای برنامهٔ رشته               | تساوی ثانیه در `created_at`                  | مهاجرت ۰۰۵ (`seq`)                                             |
| `curl` سرور → دامنه = `000`                  | بدون hairpin egress                          | از مرورگر تست کنید                                             |
| `SHOW TABLES` در bash                        | SQL در شل نیست                               | `mysql -e "..."` یا phpMyAdmin                                 |

---

### رمز را مستقیم در دیتابیس بنشانید (بدون phpMyAdmin)

```
bash scripts/set-password.sh --role coach
```

ایمیل را می‌پرسد؛ اگر ردیف نبود صریح می‌گوید ثبت‌نام کنید. اگر بود، رمز را (بدون نمایش) می‌گیرد،
هش `scrypt` می‌سازد، با `UPDATE` می‌نشاند، نقش را تنظیم می‌کند و در پایان هشِ ذخیره‌شده را از دیتابیس
می‌خواند و رمز را با قواعد `verifyPassword()` می‌سنجد. نیاز به `mysql` CLI دارد؛ اگر نبود، به
`finish-setup.sh --password` ارجاع می‌دهد.

### حلقهٔ داده را با یک دستور بسنجید

```
bash scripts/check-loop.sh
```

نمونهٔ محلی را بالا می‌آورد، با ایمیل/رمز شما وارد می‌شود (اگر حساب نباشد می‌سازد)،
`scripts/e2e-plan.mjs` را اجرا می‌کند (۱۴ بررسی: ارزیابی → برنامه → ثبت جلسه/چک‌این/وعده →
خواندن دوباره) و بعد «حقیقت دیتابیس» را می‌خواند: تعداد اسنپ‌شات، جلسات و **برچسب‌های پایبندی**.
اگر همه سالم بود، قدم بعدی `daily-export.sh` و `loop-status.mjs` و صفحهٔ `/coach/data-quality` است.

### «سایت باز نمی‌شود» — کد یا Passenger؟

```
bash scripts/check-app.sh
```

همان بیلد را چند ثانیه روی یک پورت محلی بالا می‌آورد و سه نقطهٔ انتهایی را می‌زند. سه نتیجه:

- اپ سالم + دیتابیس سالم → مشکل از Passenger/Apache است (`logs/passenger.log` + `touch tmp/restart.txt`).
- اپ سالم + `/api/db-test` خطا → متغیرهای `DB_*` به اپ نرسیده‌اند (`SetEnv` در `.htaccess`).
- اپ حتی محلی بالا نمی‌آید → آخرین ۲۵ خط لاگ node چاپ می‌شود (معمولاً ماژول گم‌شده بعد از `--prune`).

### «وارد نمی‌شوم» — تشخیص خودکار

```
bash scripts/check-login.sh
```

اتصال دیتابیس، وجود `users`/`user_sessions`، نقش و فرمت هش هر حساب را می‌خواند و اگر ایمیل و رمز
بدهید، رمز را با همان قواعد `verifyPassword()` روی هشِ ذخیره‌شده می‌سنجد. سه نتیجهٔ ممکن:

- **MATCH** → رمز درست است؛ مشکل در ثبت/خواندن نشست است (سراغ `logs/passenger.log` و `/api/auth/me`).
- **NO_MATCH** → رمز یا هش قدیمی است → `bash scripts/finish-setup.sh --password`.
- **حساب پیدا نشد** → باید ثبت‌نام شود.

### ورود ۴۰۱ می‌دهد (ایمیل/رمز رد می‌شود)

`POST /api/auth/login` برای «ایمیل ناموجود» و «هش با فرمت ناشناخته» یک پاسخ می‌دهد: ۴۰۱.
پس اول نگاه کنید ردیف و فرمت هش چه هستند (phpMyAdmin → SQL):

```sql
SELECT id, email, role, status, LEFT(password_hash, 12) AS prefix, LENGTH(password_hash) AS len FROM users ORDER BY id;
```

- `prefix = scrypt$` → حساب و فرمت درست‌اند، رمز اشتباه است → با اسکریپت زیر رمز را بازنشانی کنید.
- `prefix = $2y$` یا `$argon2…` → هشِ نسخهٔ قدیمی است و اپ آن را تأیید نمی‌کند → بازنشانی لازم است.
- SELECT خالی → این ایمیل در این دیتابیس نیست (ثبت‌نام کنید یا دیتابیس/env را چک کنید).

بازنشانی بدون نیاز به `node_modules` (روی هاست، فقط Node):

```
node scripts/make-password-hash.mjs
```

ایمیل و رمز جدید را تعاملی می‌پرسد (رمز بدون اکو تایپ می‌شود) و یک خط
`UPDATE users SET password_hash = 'scrypt$…' WHERE LOWER(email) = '…';` چاپ می‌کند؛ همان را در تب SQL اجرا کنید. اسکریپت پیش از چاپ، هش را با همان قواعد `verifyPassword()` می‌سنجد.

## ۱۱) ضمیمه

### API

| مسیر                                             | کار                                                           |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `POST /api/auth/register` \| `login` \| `logout` | نشست سروری (کوکی امضاشده)                                     |
| `POST /api/assessment`                           | ذخیرهٔ ارزیابی + ساخت خودکار برنامه                           |
| `GET /api/assessment`                            | وضعیت ارزیابی ورزشکار                                         |
| `GET/POST /api/plan`                             | برنامهٔ ذخیره‌شده یا محاسبهٔ درجا (`force:true` برای بازسازی) |
| `GET /api/plan-diagnose`                         | سلامت پایپ‌لاین: مهاجرت‌ها، ورودی‌ها، اسنپشات، dry-run        |
| `GET /api/db-test`                               | تشخیص اتصال MySQL (کد خطا + hint فارسی)                       |
| `GET /api/health`                                | بررسی زنده بودن                                               |

### جداول کلیدی

`users`, `user_sessions`, `athlete_profiles`, `sports`, `assessments`,
`assessment_answers`, `body_analysis_records`, `health_metrics`, `training_sessions`,
`workout_logs`, `nutrition_logs`, `subscriptions`, `subscription_plans`,
`recommendation_events`, `recommendation_outcomes`, `model_registry`,
`recommendation_snapshots`, view `v_latest_recommendation`.

### سیاست انتخاب برنامه

اسنپشات بازاستفاده می‌شود اگر `hashRecommendationRequest` یکسان و سن ≤ ۱۶۸ ساعت باشد؛
`POST /api/assessment` همیشه تازه‌سازی می‌کند؛ `force:true` هم.

### یک دستور، اگر سردرگم شدید

```
bash scripts/finish-setup.sh --status
```

فقط می‌خواند و می‌گوید چه چیزی هست، چه چیزی نیست و قدم بعدی کدام است. هیچ تغییری نمی‌دهد.

```
bash scripts/finish-setup.sh
```

دپلوی (`--prune`) + تنظیم رمز/نقش مربی + چک‌لیست پایانی. برای وقتی که نمی‌خواهید هفت دستور را
جدا اجرا کنید.

### ابزارها

| دستور                                   | کار                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run e2e:plan`                      | تست end-to-end روی سرور در حال اجرا                                            |
| `npm run verify:prod`                   | بررسی استاتیک بیلد تولیدی                                                      |
| `npm run code:bundle`                   | بستهٔ کد موتور برای بازبینی                                                    |
| `node scripts/check-model-parity.mjs`   | تطابق TS با آرتیفکت مدل                                                        |
| `bash scripts/deploy-cpanel.sh`         | دپلوی یک‌مرحله‌ای (پشتیبان → بیلد → مهاجرت → ری‌استارت → لاگ Passenger)        |
| `bash scripts/deploy-cpanel.sh --prune` | همان + حذف `node_modules` بعد از بیلد موفق                                     |
| `bash scripts/daily-export.sh`          | استخراج شبانهٔ دیتاست با نمونهٔ موقت + نگهداشت ۱۴ فایل آخر                     |
| `npm run loop:status`                   | گزارش وضعیت حلقهٔ داده: برچسب‌خورده‌ها، پایبندی هر آرکیتایپ، فاصله تا بازآموزی |
| `GET /api/coach-insights`               | دادهٔ `/coach/data-quality` و `/coach/insights`                                |
