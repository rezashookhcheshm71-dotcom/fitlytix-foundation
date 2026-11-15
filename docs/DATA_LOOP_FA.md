# حلقهٔ داده و بازآموزی (فاز ۶)

هدف این فاز ساده است: **مدل نباید فقط ارزیابی را ببیند؛ باید ببیند ورزشکار واقعاً چه کرد.**
تا پیش از این، ورودی‌های رفتاری (پایبندی، RPE، خواب، آمادگی، لاگ تغذیه) خالی بودند و مدل
از مقادیر پیش‌فرض خودش استفاده می‌کرد. حالا این داده‌ها از محصول جمع می‌شوند، در MySQL
می‌مانند، به برچسب نتیجه تبدیل می‌شوند و مسیر بازآموزی دارند.

```
ورزشکار داده وارد می‌کند
   /athlete/dashboard → «ثبت داده‌های امروز»
        │
        ├─ جلسه    → training_sessions
        ├─ وعده    → nutrition_logs
        └─ چک‌این  → athlete_checkins
        │
        ▼
assembleRecommendationRequest()  ← چک‌این‌ها جای پاسخ ارزیابی را می‌گیرند (≥۲ روز)
        ▼
POST /api/plan → recommendPlan() → recommendation_snapshots   (ورودی + خروجی + نسخهٔ مدل)
        ▼
labelOutcomesForUser() → recommendation_outcomes              (adherence، RPE، روزهای تغذیه)
        ▼
/api/dataset-export → JSONL → ml/train.py --calibration → model.json جدید → parity → دپلوی
```

---

## ۱) چه چیزی به محصول اضافه شد

### کارت «ثبت داده‌های امروز»

در `/athlete/dashboard` سه فرم کوچک:

| فرم    | چه می‌گیرد                      | کجا ذخیره می‌شود    | چه چیزی را در مدل تغییر می‌دهد                                    |
| ------ | ------------------------------- | ------------------- | ----------------------------------------------------------------- |
| تمرین  | عنوان، مدت، RPE، انجام‌شده/نشده | `training_sessions` | `adherence_28d`, `avg_rpe`, `rpe_trend`, `sessions_completed_28d` |
| تغذیه  | متن وعده، کالری، پروتئین        | `nutrition_logs`    | `nutrition_adherence` (نسبت روزهای ثبت‌شده)                       |
| چک‌این | خواب، استرس، آمادگی، وزن        | `athlete_checkins`  | `sleep_hours`, `stress`, `readiness_avg`, وزن                     |

نکتهٔ مهم ورزشی: مدل «تعداد روزهای ثبت‌شده» را به‌عنوان پایبندی تغذیه می‌خواند، نه دقت
کالری. پس ثبت ساده و روزانه ارزشمندتر از ثبت دقیق اما پراکنده است.

### API

| مسیر                                 | توضیح                                                                 |
| ------------------------------------ | --------------------------------------------------------------------- |
| `POST /api/logs`                     | `{ kind: "session" \| "nutrition" \| "checkin", payload: {…} }` → 201 |
| `GET /api/logs?days=14`              | آخرین داده‌های ثبت‌شدهٔ ورزشکار (برای UI)                             |
| `GET /api/dataset-export?limit=5000` | خروجی NDJSON آموزشی — فقط با هدر `x-dataset-token`                    |

`POST /api/logs` بعد از هر نوشتن، برچسب نتیجهٔ برنامهٔ فعلی را هم به‌روز می‌کند.

### مهاجرت ۰۰۶

```sql
-- 1) جدول چک‌این
CREATE TABLE IF NOT EXISTS athlete_checkins ( … );   -- در فایل 006 کامل است

-- 2) ستون‌های برچسب نتیجه
ALTER TABLE recommendation_outcomes
  ADD COLUMN snapshot_id CHAR(36) NULL,
  ADD COLUMN window_days SMALLINT UNSIGNED NULL,
  ADD COLUMN nutrition_adherence DECIMAL(4,3) NULL,
  ADD COLUMN avg_rpe DECIMAL(4,1) NULL,
  ADD COLUMN label_source VARCHAR(24) NOT NULL DEFAULT 'auto',
  ADD UNIQUE KEY uq_outcome_snapshot (snapshot_id);
```

اجرا: phpMyAdmin → تب SQL (یا `--with-migrations` اسکریپت دپلوی که ۰۰۴/۰۰۵/۰۰۶ را می‌زند).

### تغییر در چیدمان ورودی‌ها

اگر ورزشکار در ۱۴ روز گذشته **دو چک‌این یا بیشتر** داشته باشد:

- `common.recovery.sleep_hours` با میانگین واقعی خواب جایگزین می‌شود،
- `common.recovery.stress` با میانگین استرس (۱ تا ۵)،
- `behavior.readinessAvg` از میانگین آمادگی پر می‌شود،
- و در پاسخ برنامه `sourcesFa` شامل «چک-این روزانه (n روز)» می‌شود.

یک شب بد هرگز کل برنامه را عوض نمی‌کند؛ برای همین حد آستانه دو چک‌این گذاشته شده است.

---

## ۲) برچسب نتیجه (outcome) چطور ساخته می‌شود

`src/services/recommendation/outcomes.server.ts`

| مؤلفه                 | محاسبه                                                           |
| --------------------- | ---------------------------------------------------------------- |
| `window_days`         | فاصلهٔ امروز تا زمان ساخت اسنپشات (حداقل ۳ روز تا برچسب زده شود) |
| `adherence`           | جلسات انجام‌شده ÷ جلسات انتظاری (`sessionsPerWeek × روزها ÷ ۷`)  |
| `sessions_completed`  | تعداد جلسات با `status='completed'` در همان بازه                 |
| `nutrition_adherence` | روزهای یکتای `nutrition_logs` ÷ `window_days`                    |
| `avg_rpe`             | میانگین `perceived_exertion`                                     |
| `completed_cycle`     | آیا دورهٔ برنامه (۱/۳/۶/۱۲ ماه) تمام شده                         |
| `progress_score`      | ۶۰٪ پایبندی + ۲۰٪ تغذیه + ۲۰٪ کیفیت RPE (فقط برای گزارش)         |

قواعد: هر اسنپشات **یک بار** برچسب می‌خورد (`uq_outcome_snapshot`)، و اگر بازهٔ مشاهده
کوتاه‌تر از ۳ روز باشد برچسب زده نمی‌شود تا «نبود داده» به‌اشتباه «پایبندی پایین» ثبت نشود.

---

## ۳) استخراج دیتاست

```sh
cd ~/public_html/fitlytix-app
```

```sh
env DB_HOST=localhost DB_NAME=eugtezmj_fitlytix DB_USER=eugtezmj_fitlytix DB_PASSWORD=<رمز> SESSION_SECRET=x DATASET_EXPORT_TOKEN=<توکن> PORT=3999 node .output/server/index.mjs > /tmp/exp.log 2>&1 &
```

```sh
DATASET_BASE_URL=http://127.0.0.1:3999 DATASET_EXPORT_TOKEN=<توکن> node scripts/export-dataset.mjs
```

خروجی:

- `data/datasets/dataset-<timestamp>.jsonl` — برای هر برنامه: بردار ویژگی دقیقاً همان که
  در زمان سرو استفاده شد، اکشنِ انتخاب‌شده، و (اگر برچسب خورده) نتیجهٔ واقعی
- `data/datasets/dataset-<timestamp>.report.json` — پوشش داده: چند ردیف، چند برچسب، میانگین
  پایبندی، پخش رشته‌ها و آرکیتایپ‌ها

> `data/datasets/` در `.gitignore` است؛ این داده‌ها حاوی اطلاعات ورزشکاران‌اند و نباید کامیت شوند.

---

## ۴) بازآموزی (با دروازهٔ کیفیت)

```sh
node scripts/retrain.mjs --dataset data/datasets/dataset-<timestamp>.jsonl
```

چه می‌کند:

1. برچسب‌های معتبر (بازهٔ ≥۷ روز) را می‌شمارد؛
2. اگر کمتر از `--min-labelled` (پیش‌فرض ۲۰۰) بود، **بازآموزی را رد می‌کند** (`exit 3`);
3. در غیر این صورت `data/datasets/calibration.json` می‌سازد (میانگین واقعی پایبندی، به تفکیک رشته)؛
4. `python ml/train.py --rows 48000 --seed 42 --calibration …` را اجرا می‌کند؛
5. `node scripts/check-model-parity.mjs` را اجرا می‌کند و اگر پاریتی نشکست، ادامه می‌دهد.

### چرا calibration و نه تغییر هدف؟

با این حجم داده، آموزش نظارتی مستقیم روی outcomeها بی‌معناست (چند صد ردیف، برچسب پرنویز).
کاری که می‌کنیم صادقانه‌تر است: **همان سیاست مربیگری حفظ می‌شود، اما توزیع پایبندیِ
شبیه‌سازی‌شده به واقعیت منتقل می‌شود** (prior matching). اثرش این است که مدل دیگر خوش‌بینانه
فرض نمی‌کند ورزشکار پایبندی ۰٫۷ دارد، اگر دادهٔ واقعی چیز دیگری می‌گوید.

وقتی حجم برچسب‌ها به چند هزار رسید، قدم بعدی آموزش روی outcomeها به‌عنوان هدف است
(`trainingData: "logged"`).

### نسخه‌بندی

`modelVersion` در `ml/train.py` از تاریخ + sha گیت ساخته می‌شود؛ پس مدل جدید خودکار نسخهٔ
تازه می‌گیرد. اسنپشات‌های قدیمی چون ورودی و نسخهٔ مدل را ذخیره کرده‌اند دست‌نخورده می‌مانند و
همیشه قابل بازپخش‌اند.

---

## ۵) چک‌لیست پذیرش

- [ ] مهاجرت ۰۰۶ اجرا شده: `/api/plan-diagnose` → `006_data_loop_checkins_outcomes: true`
- [ ] ثبت یک جلسه از داشبورد → ردیف در `training_sessions`
- [ ] ثبت یک چک‌این → ردیف در `athlete_checkins` (ثبت دوباره در همان روز = به‌روزرسانی)
- [ ] ثبت یک وعده → ردیف در `nutrition_logs`
- [ ] `GET /api/logs?days=14` هر سه را برمی‌گرداند
- [ ] `GET /api/plan` بعد از ثبت، `sourcesFa` شامل «سابقه جلسات ۲۸ روز» و با دو چک‌این
      «چک-این روزانه» را نشان می‌دهد
- [ ] پس از ۳ روز و داشتن جلسه/وعده، `SELECT * FROM recommendation_outcomes WHERE snapshot_id IS NOT NULL` ردیف دارد
- [ ] `node scripts/export-dataset.mjs` فایل JSONL می‌سازد و گزارش کیفیت می‌دهد

---

## ۶) کوئری‌های کاربردی

```sql
SELECT COUNT(*) FROM athlete_checkins;
SELECT COUNT(*) FROM recommendation_outcomes WHERE snapshot_id IS NOT NULL;
SELECT athlete_id, adherence, sessions_completed, window_days, nutrition_adherence, avg_rpe, progress_score FROM recommendation_outcomes ORDER BY recorded_at DESC LIMIT 10;
SELECT sport, archetype_id, COUNT(*) FROM recommendation_snapshots GROUP BY sport, archetype_id;
```

```sql
SELECT archetype_id, AVG(adherence) AS mean_adherence, COUNT(*) AS n FROM recommendation_snapshots s JOIN recommendation_outcomes o ON o.snapshot_id = s.id GROUP BY archetype_id HAVING n >= 5;
```

آخری، مهم‌ترین گزارش محصولی است: کدام آرکیتایپ در واقعیت پایبندی بالاتری می‌سازد.

---

## ۷) نمای مربی: شفافیت داده و عملکرد واقعی

دو صفحهٔ جدید، هر دو روی دادهٔ واقعی دیتابیس (نه mock) و فقط با نقش مربی/مدیر:

| صفحه                  | چه نشان می‌دهد                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/coach/data-quality` | برای هر ورزشکار: جلسات ۲۸ روز (انجام‌شده/کل)، RPE، روزهای تغذیه، چک‌این ۱۴ روز، خواب/آمادگی، برنامهٔ فعلی و `data_completeness` که مدل هنگام ساخت ثبت کرده، پایبندی اندازه‌گیری‌شده و یک «امتیاز کیفیت داده» |
| `/coach/insights`     | رتبه‌بندی آرکیتایپ‌ها بر اساس پایبندی واقعی: تعداد برنامه، تعداد نمونهٔ برچسب‌خورده، پایبندی تمرین و تغذیه، RPE، دوره‌های کامل‌شده                                                                           |

منبع هر دو: `GET /api/coach-insights` (نقش `coach`/`head_coach`/`admin`).

امتیاز کیفیت داده = ۴۰٪ جلسات (هدف ۱۲ در ۲۸ روز) + ۳۰٪ روزهای تغذیه (هدف ۲۰) + ۳۰٪
چک‌این (هدف ۱۴). آستانه‌ها: `good ≥ 0.6`, `fair ≥ 0.25`, در غیر این‌صورت `poor`.

تفسیر ورزشی: آرکیتایپی که در دفتر خوب است اما در واقعیت رها می‌شود، یعنی بار تمرین با
زندگی ورزشکار نمی‌خواند. این جدول دقیقاً همان چیزی است که در بازآموزی استفاده می‌شود.

### کوئری‌های معادل (وقتی صفحه در دسترس نیست)

```sql
SELECT s.archetype_id, COUNT(*) AS plans, AVG(o.adherence) AS mean_adherence, AVG(o.nutrition_adherence) AS mean_nutrition, AVG(o.avg_rpe) AS mean_rpe FROM recommendation_snapshots s JOIN recommendation_outcomes o ON o.snapshot_id = s.id GROUP BY s.archetype_id ORDER BY mean_adherence DESC;
```

```sql
SELECT athlete_user_id, COUNT(*) AS sessions, AVG(perceived_exertion) AS rpe FROM training_sessions WHERE scheduled_at >= (NOW() - INTERVAL 28 DAY) GROUP BY athlete_user_id ORDER BY sessions DESC;
```

---

## ۸) ثبت یک‌ضربه‌ای جلسه در `/athlete/program`

بالای بلوک‌های تمرین امروز، کارت «جلسهٔ امروز انجام شد؟» اضافه شد:

- **جلسه را انجام دادم** → `training_sessions` با `status=completed` و RPE وارد‌شده
- **امروز تمرین نکردم** → همان ردیف با `status=missed` (سیگنال واقعی، نه خطا)
- کارت کامل «ثبت داده‌های امروز» هم پایین همین صفحه تکرار شده است

اثر فوری: `/api/plan` با `force:true` بازسازی می‌شود و `missingFa`/`sourcesFa` به‌روز می‌شوند.

---

## ۹) خودکارسازی و نگهداری (بدهی‌های فنی بسته‌شده)

| مورد                        | راه‌حل                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| نبود لاگ Passenger          | `deploy-cpanel.sh` حالا خط `PassengerAppLogFile <app>/logs/passenger.log` را (اگر نباشد) اضافه و پوشهٔ `logs/` را می‌سازد                                          |
| حجم `node_modules` روی هاست | `bash scripts/deploy-cpanel.sh --prune` بعد از بیلد موفق، `node_modules` را پاک می‌کند (Nitro وابستگی‌ها را باندل می‌کند؛ بیلد بعدی دوباره نصب می‌کند)             |
| استخراج دستی دیتاست         | `bash scripts/daily-export.sh` نمونهٔ موقت را بالا می‌آورد، استخراج می‌کند، خاموش می‌کند و فقط ۱۴ دیتاست آخر را نگه می‌دارد                                        |
| فاصله تا بازآموزی           | `npm run loop:status` (فقط Node، روی هاست هم اجرا می‌شود): ردیف/برچسب، پایبندی واقعی هر آرکیتایپ، پرشده‌ترین سیگنال‌های کم، و تعداد ردیف باقی‌مانده تا آستانهٔ ۲۰۰ |

### کرون شبانه

```
10 3 * * * cd $HOME/public_html/fitlytix-app && /bin/bash scripts/daily-export.sh >> $HOME/logs/dataset-export.log 2>&1
```

> توکن در هر اجرا تولید و فقط برای همان نمونهٔ موقت استفاده می‌شود؛ روی اپ اصلی
> (`Passenger`) عمداً تنظیم نمی‌شود تا endpoint عمومی نشود.
