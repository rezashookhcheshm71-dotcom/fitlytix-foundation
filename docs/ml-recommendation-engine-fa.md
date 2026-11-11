# موتور پیشنهاد برنامه FitLytix — سند فنی

> هدف: کاربر ثبت‌نام می‌کند، ارزیابی اولیه را پر می‌کند، رشته و دوره (۱/۳/۶/۱۲ ماه) را
> انتخاب می‌کند؛ سیستم بر اساس **ارزیابی اولیه + رفتار واقعی + ساختار رشته + ساختار تغذیه**
> یک برنامه تمرین و یک ساختار تغذیه پیشنهاد می‌دهد و می‌گوید «چرا».

این سند کنار `ml/README.md` خوانده شود: آنجا جزئیات آموزش، اینجا معماری محصول و استقرار.

---

## ۱) خلاصه اجرایی

| موضوع                      | تصمیم                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| نوع مدل                    | Gradient Boosted Decision Trees (scikit-learn) — ۴ مدل طبقه‌بندی + ۲ رگرسور                                   |
| محل آموزش                  | offline، روی سیستم خودتان (`ml/train.py`)                                                                     |
| محل اجرا                   | **همان سرور Node** (Nitro / cPanel-Passenger) — بدون پایتون در runtime                                        |
| قالب مدل                   | JSON خالص (`model.json`، ~۱.۳ مگابایت) شامل درخت‌ها، نگاشت ویژگی‌ها و archetypeها                             |
| چرا JSON و نه pickle/ONNX؟ | بدون وابستگی باینری، قابل بازبینی، parity دقیق با sklearn (خطای ~`6e-7`)                                      |
| خروجی                      | archetype برنامه + تعداد جلسه + طول دوره + استراتژی تغذیه + نوع مربیگری + پیش‌بینی پایبندی + هشدارهای ایمنی   |
| حلقه یادگیری               | ثبت هر تصمیم در `recommendation_events` و نتیجه دوره در `recommendation_outcomes` → آموزش مجدد روی داده واقعی |

---

## ۲) معماری

```
[ارزیابی عمومی + ارزیابی رشته]  [آنالیز بدن]  [رفتار ۲۸ روز: پایبندی، RPE، آمادگی]
                 │                    │                     │
                 └────────────┬───────┴─────────────────────┘
                              ▼
        src/services/recommendation/features.ts
        (نگاشت پاسخ‌ها → ۵۶ ویژگی عددی، imputation با میانه آموزش)
                              ▼
        ┌──────────────────────────────────────────────┐
        │  مدل JSON (بدون وابستگی)                     │
        │  program[رشته] · nutrition · duration ·      │
        │  coaching · sessions · adherence             │
        └──────────────────────────────────────────────┘
                              ▼
        guardrails.ts  ← درد/آسیب، خواب، استرس، آمادگی،
                         پایبندی قبلی، سن، محدودیت‌های کاربر
                              ▼
        archetypes.ts + nutrition.ts
        (ساختار هفتگی رشته + ساختار وعده و بازه ماکرو)
                              ▼
        explain.ts  (Ablation: چرا این انتخاب؟)
                              ▼
        POST /api/recommend  →  UI
                              ▼
        recommendation_events  →  (پایان دوره)  →  recommendation_outcomes
                              ▼
                       آموزش مجدد offline
```

نکته مهم: موتور، **قاعده‌محور صرف نیست**. انتخاب برنامه با مدل انجام می‌شود؛ قواعد فقط
برای ایمنی، محدودیت‌های کاربر و حالت fallback هستند.

---

## ۳) فضای اقدام (Action space)

هر رشته چهار archetype دارد؛ مدل یکی را انتخاب می‌کند:

| رشته         | Archetypeها                                                            |
| ------------ | ---------------------------------------------------------------------- |
| CrossFit     | پایه و اسکیلینگ · قدرت و مهارت · موتور و آمادگی مسابقه · عملکرد متعادل |
| Hyrox        | پایه هوازی · قدرت ایستگاه‌ها · آماده‌سازی مسابقه · نگهداشت ترکیبی      |
| Functional   | بنیان حرکت · قدرت متعادل · آمادگی عمومی · تحرک و بازگشت                |
| Bodybuilding | تمام‌بدن پایه · بالاتنه/پایین‌تنه · فشار/کشش/پا · تمرکز روی نقاط ضعف   |
| Running      | ساخت پایه · آستانه ۵–۱۰K · نیم‌ماراتن · سرعت و نگهداشت                 |

اینکه هر archetype چه هفته‌ای دارد، در `src/services/recommendation/archetypes.ts` است
(مجزا از مدل) تا مربی بتواند قالب‌ها را بازبینی کند بدون آنکه مدل عوض شود.

---

## ۴) ویژگی‌ها (۵۶ ورودی)

| گروه        | نمونه                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| رشته و هدف  | one-hot رشته، هدف اصلی و ثانویه                                                                           |
| پروفایل     | سن، جنسیت، قد، وزن، BMI، سابقه و سال تمرین                                                                |
| ظرفیت عملی  | جلسات در دسترس، دقیقه هر جلسه، تجهیزات، محیط، فعالیت روزانه، سبک کار                                      |
| ریکاوری     | خواب، کیفیت خواب، استرس، درد و ناحیه درد                                                                  |
| اندازه‌گیری | درصد چربی، شاخص قدرت نسبی (۱RM/وزن)، شاخص موتور (رکوردهای هوازی)، مهارت، موبیلیتی، مسافت هفتگی            |
| رفتار       | پایبندی ۲۸ روز، RPE میانگین و روند، جلسات ازدست‌رفته، تکمیل بازخورد، آمادگی، پایبندی تغذیه، سابقه دوره‌ها |

دو نکته طراحی:

- هر ویژگی «موجود بودن» خودش را جدا دارد (`strength_available`, `adherence_available`, …).
  بنابراین مدل می‌فهمد یک عدد **اندازه‌گیری شده** است یا **جایگزین‌شده**.
- مقادیر جایگزین (میانه آموزش) داخل `model.json` ذخیره می‌شوند تا runtime هرگز
  مقدار متفاوتی از آموزش استفاده نکند.

---

## ۵) قرارداد API

### `POST /api/recommend`

احراز هویت اختیاری است؛ اگر کاربر لاگین باشد، `athleteId` از session گرفته می‌شود و
تصمیم به نام او ثبت می‌شود.

```bash
curl -X POST http://localhost:8080/api/recommend \
  -H 'content-type: application/json' \
  -d '{
    "sport": "crossfit",
    "profile": { "age": 29, "gender": "male", "heightCm": 178, "weightKg": 78 },
    "assessmentAnswers": {
      "common.profile.training_history": "option_3",
      "common.goals.primary": "option_2",
      "common.schedule.sessions_per_week": 4,
      "common.schedule.minutes_per_session": "option_3",
      "common.safety.pain": "option_1",
      "common.recovery.sleep_hours": 7,
      "crossfit.strength.back_squat_1rm": 120,
      "crossfit.engine.row_2k": "7:20"
    },
    "bodyAnalysis": { "bodyFatPct": 17.5 },
    "behavior": {
      "plannedSessions": 16, "completedSessions": 13, "avgRpe": 7.6,
      "readinessAvg": 71, "nutritionAdherence": 0.8, "priorPlanCount": 1,
      "priorPlanMonths": 3, "daysSinceSignup": 120
    },
    "constraints": { "durationMonths": "auto", "packageId": "combined" }
  }'
```

پاسخ (خلاصه‌شده):

```json
{
  "ok": true,
  "recommendation": {
    "model": { "version": "2026.11.11-…", "source": "model", "schemaVersion": 1 },
    "program": {
      "archetypeId": "cf_strength_skill",
      "labelFa": "قدرت و مهارت",
      "sessionsPerWeek": 4,
      "weeks": 13,
      "deloadWeekIndexes": [4, 8],
      "days": [
        { "index": 1, "titleFa": "قدرت · اسکوات", "blocks": ["warmup", "strength", "cooldown"] }
      ]
    },
    "nutrition": {
      "strategyId": "recomp",
      "labelFa": "بازترکیب بدن",
      "macros": [{ "id": "protein", "gPerKg": [2.2, 2.6] }],
      "dayTypes": [{ "dayType": "hard", "carbMultiplier": 1.3 }]
    },
    "duration": { "months": 3, "overrideApplied": false },
    "coaching": { "mode": "hybrid" },
    "expectations": { "adherence30d": 0.91, "adherenceCycle": 0.78, "confidence": "high" },
    "safety": { "level": "none", "flags": [] },
    "explanations": [
      { "labelFa": "سابقه تمرین", "valueFa": "متوسط", "direction": "supports", "weight": 0.11 }
    ],
    "inputs": { "used": ["سن", "سابقه تمرین", "…"], "missing": ["ترکیب بدن"] }
  },
  "diagnostics": { "latencyMs": 9, "featureCount": 56, "fallbackReasons": [] }
}
```

### `GET /api/recommend`

اطلاعات نسخه مدل، دقت‌های ارزیابی و لیست رشته/دوره‌ها را برمی‌گرداند (برای health-check و
پنل ادمین).

---

### `GET|POST /api/plan` — برنامهٔ خود ورزشکار (مسیر واقعی محصول)

مسیر اصلی محصول همین است: هیچ ورودی‌ای از کلاینت پذیرفته نمی‌شود و همهٔ سیگنال‌ها از
رکوردهای همان کاربر لاگین‌شده خوانده می‌شوند.

```bash
curl -s https://app.fitlytix.ir/api/plan                      # برنامهٔ ذخیره‌شده یا محاسبهٔ تازه
curl -s -X POST https://app.fitlytix.ir/api/plan \
  -H 'content-type: application/json' \
  -d '{"regenerate": true, "constraints": {"durationMonths": 3}}'
```

پاسخ: `{ ok, plan, program, workout, meta }`

| بخش       | محتوا                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- |
| `plan`    | خلاصهٔ تایپ‌دار (`PlanSummary`): archetype، جلسات/هفته، مدت جلسه، دوره، تغذیه، مربی‌گری، ایمنی، پایبندی |
| `program` | `Program` آمادهٔ رندر در `/athlete/program` (روزها، بلوک‌ها، حرکت‌ها، دقیقه‌ها)                         |
| `workout` | جلسهٔ امروز                                                                                             |
| `meta`    | `fromSnapshot`, `persisted`, `generatedAt`, `inputHash`, `sourcesFa`, `missingFa`, `diagnostics`        |

منابع ورودی (همه اختیاری، با تخریب تدریجی):

| منبع               | جدول                       | چه چیزی می‌دهد                                        |
| ------------------ | -------------------------- | ----------------------------------------------------- |
| ارزیابی عمومی/رشته | `assessments.answers_json` | همان ۵۶ ویژگی (کلیدها عیناً `common.*`, `crossfit.*`) |
| پروفایل            | `athlete_profiles`         | سن، جنسیت، قد، وزن، سطح تجربه                         |
| ترکیب بدن          | `body_analysis_records`    | درصد چربی آخرین اندازه‌گیری                           |
| رفتار ۲۸ روز       | `training_sessions`        | برنامه‌ریزی‌شده/انجام‌شده، RPE جاری و دورهٔ قبل       |
| پایبندی تغذیه      | `nutrition_logs`           | روزهای ثبت‌شده در ۲۸ روز                              |
| اشتراک             | `subscriptions` + `plans`  | طول دوره و بستهٔ خریداری‌شده                          |

### چرخهٔ تولید و ذخیره (snapshot)

1. پایان ارزیابی (`POST /api/assessment`) → `refreshPlanForUser` برنامه را می‌سازد و ذخیره می‌کند.
   این مرحله best-effort است و هرگز ذخیرهٔ ارزیابی را خراب نمی‌کند.
2. `/athlete/program` و داشبورد با `GET /api/plan` همان برنامه را می‌خوانند؛ تا وقتی ورودی‌ها
   عوض نشده‌اند، همان snapshot برمی‌گردد (پس برنامه زیر پای کاربر تغییر نمی‌کند).
3. تغییر هر ورودی (ارزیابی جدید، رفتار جدید) یا گذشت ۷ روز → محاسبهٔ مجدد و snapshot تازه.
4. هر snapshot در `recommendation_snapshots` با `input_hash` + `model_version` یکتا می‌شود،
   پس ورودی یکسان با مدل یکسان رکورد تکراری نمی‌سازد.

## ۶) گاردریل‌های ایمنی (پس از مدل اجرا می‌شوند)

| شرایط                                 | اثر                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| درد با محدودیت پزشک                   | برنامه به نسخه کم‌فشار رشته، حداکثر ۳ جلسه، مربی انسانی، دوره ≤ ۳ ماه، `review_required` |
| درد ۱.۶ به بالا                       | جایگزینی برنامه‌های پربرخورد، یک جلسه کمتر، حداقل `hybrid`                               |
| خواب < ۶ ساعت / استرس ۵ / آمادگی < ۵۰ | یک جلسه کاهش حجم + هشدار                                                                 |
| پایبندی ۲۸ روز < ۵۰٪                  | دوره به ۱ ماه، حداقل `hybrid`، توضیح شفاف                                                |
| BMI < ۱۸.۵ با هدف کاهش چربی           | هدف تغذیه به ساخت تدریجی تغییر می‌کند                                                    |
| سن < ۱۶                               | بارگذاری محافظه‌کارانه + بازبینی انسانی                                                  |
| محدودیت صریح کاربر                    | سقف جلسات و طول دوره اعمال می‌شود                                                        |

هر تغییر با `safety.flags` و متن فارسی برمی‌گردد؛ هیچ اوررایدی بی‌صدا انجام نمی‌شود.

---

## ۷) توضیح‌پذیری

دو لایه:

1. **ورودی‌های مصرف‌شده/گمشده** (`inputs.used` / `inputs.missing`) — شفافیت داده.
2. **Ablation attribution** — برای هر ویژگی مهم، مقدارش با میانه آموزش جایگزین می‌شود و
   تغییر احتمال کلاس انتخاب‌شده اندازه‌گیری می‌شود. نتیجه یک «سهم محلی» واقعی برای همین مدل
   است، نه SHAP تقلبی. هزین‌اش چند میکروثانیه است چون درخت‌ها کوچک‌اند (عمق ۳).

---

## ۸) استقرار روی سرور خودتان

مدل داخل باندل سرور قرار می‌گیرد (import JSON در `model.server.ts`)، بنابراین هیچ سرویس
جداگانه‌ای لازم نیست. **روی سرور به پایتون نیازی نیست**؛ پایتون فقط برای آموزش است.

### چک‌لیست استقرار (cPanel / Passenger)

```sh
# 1) کد + آرتیفکت مدل
cd ~/fitlytix-app && git pull origin main
ls -lh src/services/recommendation/model/        # model.json ≈ 1.3MB

# 2) نصب و بیلد در محیط Node همان اپ
source ~/nodevenv/fitlytix-app/22/bin/activate
node -v                                          # 22.x (حداقل 20.19)
npm ci
npm run build
du -sh .output                                   # ~8MB
grep -c fitlytix-gbdt-json .output/server/_ssr/router-*.mjs   # باید > ۰ باشد
```

3. cPanel → **Setup Node.js App** → Environment variables:

| متغیر                                                         | مقدار                                 |
| ------------------------------------------------------------- | ------------------------------------- |
| `NODE_ENV`                                                    | `production`                          |
| `SESSION_SECRET`                                              | ۳۲+ کاراکتر تصادفی                    |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | اطلاعات MySQL                         |
| `PORT`                                                        | **تنظیم نشود**؛ Passenger خودش می‌دهد |

Startup file: `app.js`. فایل `.env` به‌تنهایی توسط سرور بیلدشده خوانده نمی‌شود؛ متغیرها را در
همین UI (یا `EnvironmentFile` در systemd) بگذارید.

4. migration `003` را در phpMyAdmin (بعد از Backup) import کنید. بدون آن API کار می‌کند ولی
   هیچ تصمیمی ثبت نمی‌شود و داده‌ای برای آموزش مجدد جمع نمی‌شود.

5. Restart: دکمه cPanel یا `touch tmp/restart.txt`.

6. تأیید:

```sh
curl -s https://app.fitlytix.ir/api/health
curl -s https://app.fitlytix.ir/api/recommend | head -c 300     # نسخه + دقت‌ها
POST=$(curl -s -X POST https://app.fitlytix.ir/api/recommend \
  -H 'content-type: application/json' \
  -d '{"sport":"crossfit","profile":{"experience":"intermediate","primaryGoal":"strength","sessionsPerWeek":4}}')
echo "$POST" | head -c 400
npm run verify:prod https://app.fitlytix.ir
```

`verify:prod` علاوه بر صفحه‌ها، یک inference واقعی می‌گیرد و باید خطی مثل این چاپ کند:
`200 POST /api/recommend -> cf_strength_skill · 6mo · recomp · model … (model, simulated)`.

### بدون SSH

- cPanel → **Terminal** و اجرای همان دستورها.
- یا بیلد روی سیستم خودتان و آپلود فقط `.output/` + `app.js`؛ نسخه Node مبدأ و سرور باید یکسان باشد.

### VPS با systemd + nginx

```ini
# /etc/systemd/system/fitlytix.service
[Unit]
Description=FitLytix
After=network.target

[Service]
WorkingDirectory=/var/www/fitlytix
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/var/www/fitlytix/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### آپدیت‌ها و آموزش مجدد

- آپدیت اپ: `git pull && npm ci && npm run build && touch tmp/restart.txt`.
- آموزش مجدد: روی ماشین دارای پایتون `python ml/train.py` → commit/push کردن `model.json` →
  روی سرور `git pull && npm run build` + Restart. مدل را روی سرور آموزش ندهید.

### عیب‌یابی مخصوص مدل

| نشانه                                                 | علت / راه‌حل                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Cannot find module .output/server/index.mjs`         | بیلد انجام نشده یا در پوشه اشتباه                                             |
| `MODEL_FORMAT_UNSUPPORTED` یا ۵۰۰ در `/api/recommend` | `model.json` ناقص/قدیمی است؛ حجم و `git status` را چک کنید و دوباره بیلد کنید |
| لاگ `[recommendation] model/runtime contract issues`  | مدل و کد از دو کامیت مختلف‌اند؛ همان کامیت را بیلد کنید                       |
| ۴۰۳ `Blocked request`                                 | فقط مربوط به dev server و allowlist است؛ روی prod وجود ندارد                  |
| اولین درخواست ۱–۲ ثانیه                               | parse یک‌بارهٔ مدل؛ بعد از آن ۲–۱۵ms                                          |
| بیلد روی هاست کم‌حافظه                                | `NODE_OPTIONS=--max-old-space-size=2048 npm run build`                        |

## ۹) داده و حلقه بازخورد

migration: `database/migrations/mysql/003_fitlytix_recommendation_engine.sql`

- `recommendation_events`: نسخه مدل، ورودی کامل، خروجی کامل، archetype، دوره، زمان پاسخ.
- `recommendation_outcomes`: پایان دوره، پایبندی، تعداد جلسات، امتیاز پیشرفت.
- `model_registry`: نسخه فعال و SHA256 آرتیفکت.

با این سه جدول، آموزش بعدی روی **داده واقعی** انجام می‌شود (راهنما در `ml/README.md`).
تا آن زمان، مدل فعلی روی داده مصنوعی آموزش دیده و باید همین‌طور برچسب‌گذاری شود
(`model.source` و متن UI).

---

## ۱۰) ارزیابی فعلی (مدل ۲۰۲۶.۱۱.۱۱)

روی ۹٬۶۰۰ ورزشکار **تست دیده‌نشده** از همان کوهورت شبیه‌سازی‌شده:

| خروجی             | دقت  | Top-2 | خط پایه (بیشترین کلاس) |
| ----------------- | ---- | ----- | ---------------------- |
| CrossFit (۴ کلاس) | ۰.۸۵ | ۰.۹۵  | ۰.۴۷                   |
| Hyrox             | ۰.۸۸ | ۰.۹۸  | ۰.۳۲                   |
| Functional        | ۰.۸۹ | ۰.۹۷  | ۰.۳۱                   |
| Bodybuilding      | ۰.۷۱ | ۰.۹۱  | ۰.۴۵                   |
| Running           | ۰.۸۷ | ۰.۹۶  | ۰.۴۸                   |
| تغذیه (۵ کلاس)    | ۰.۹۴ | ۰.۹۹  | ۰.۳۰                   |
| طول دوره (۴ کلاس) | ۰.۷۰ | ۰.۹۱  | ۰.۵۱                   |
| نوع مربیگری       | ۰.۷۷ | ۰.۹۸  | ۰.۵۲                   |

رگرسورها: تعداد جلسه `MAE 0.255 / R² 0.834`؛ پایبندی `MAE 0.066 / R² 0.797` با
حداکثر فاصله کالیبراسیون `0.016`.

**تفسیر درست:** این اعداد یعنی «مدل، سیاست شبیه‌ساز را روی ورزشکار دیده‌نشده بازتولید می‌کند».
یعنی pipeline، featureها، export و runtime درست کار می‌کنند. **به معنی اثربخشی واقعی روی
انسان نیست** و تا آموزش روی داده واقعی نباید در بازاریابی چنین ادعایی شود.

---

## ۱۱) محدودیت‌ها و نقشه راه

1. **داده مصنوعی** — بزرگ‌ترین محدودیت. مسیر: فعال کردن ثبت تصمیم + جمع‌آوری ۹۰ روزه + آموزش مجدد.
2. **بدون حلقه کاوشی** — فعلاً همیشه بهترین اقدام انتخاب می‌شود. برای یادگیری بلندمدت،
   ۵–۱۰٪ ترافیک را به انتخاب تصادفی کنترل‌شده بدهید (contextual bandit).
3. **تغذیه ساختاری است، نه دقیق** — برای نسخه درمانی/کلینیکی به بازبینی متخصص نیاز است.
4. **پایش drift** — توزیع ویژگی‌ها (سن، پایبندی، رشته) را ماهانه با `recommendation_events`
   مقایسه کنید؛ تغییر زیاد = زمان آموزش مجدد.
5. **A/B test** — قبل از جایگزینی کامل سیاست قبلی، مدل را روی درصدی از کاربران آزمایش کنید
   و پایبندی ۳۰ روزه و نرخ اتمام دوره را بسنجید.

---

## ۱۲) فایل‌های مرتبط

| مسیر                                              | نقش                              |
| ------------------------------------------------- | -------------------------------- |
| `ml/train.py`                                     | آموزش، ارزیابی، خروجی JSON       |
| `ml/fitlytix_ml/schema.py`                        | منبع واحد ویژگی‌ها و archetypeها |
| `ml/fitlytix_ml/simulator.py`                     | شبیه‌ساز کوهورت و تابع سود       |
| `src/services/recommendation/engine.ts`           | هماهنگ‌کننده                     |
| `src/services/recommendation/features.ts`         | نگاشت ارزیابی → بردار ویژگی      |
| `src/services/recommendation/ensemble.ts`         | مفسر درخت‌های JSON               |
| `src/services/recommendation/guardrails.ts`       | ایمنی و محدودیت‌ها               |
| `src/services/recommendation/archetypes.ts`       | ساختار هفتگی هر برنامه           |
| `src/services/recommendation/nutrition.ts`        | ساختار تغذیه هر استراتژی         |
| `src/routes/api/recommend.ts`                     | endpoint آمارِ/دموی مدل          |
| `src/routes/api/plan.ts`                          | endpoint برنامهٔ خود ورزشکار     |
| `src/services/recommendation/assembly.server.ts`  | ساخت درخواست از دادهٔ DB         |
| `src/services/recommendation/userPlan.server.ts`  | چرخهٔ snapshot/محاسبهٔ مجدد      |
| `src/services/recommendation/snapshots.server.ts` | ذخیره/خواندن snapshot            |
| `src/services/recommendation/presentation.ts`     | نگاشت خروجی مدل → `Program`      |
| `src/hooks/use-plan.ts`                           | hook کلاینت برای `/api/plan`     |
| `src/components/domain/plan-summary.tsx`          | کارت داشبورد                     |
| `scripts/check-model-parity.mjs`                  | صحت‌سنجی TS ↔ sklearn            |
| `database/migrations/mysql/003_…sql`              | جدول‌های ثبت تصمیم/نتیجه         |
| `database/migrations/mysql/004_…sql`              | snapshot برنامه‌های تولیدشده     |
