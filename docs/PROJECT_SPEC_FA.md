# FitLytix — سند تفصیلی بیزینس، UI/UX و تکنیکال

> این سند از صفر و بر پایهٔ **خود مخزن** نوشته شده است (کد، مهاجرت‌ها، آرتیفکت مدل، توکن‌های بصری).
> هر عددی که اینجا آمده قابل ردیابی به یک فایل است. جای سند خلاصهٔ `docs/PROJECT_BRIEF_FA.md` را
> نمی‌گیرد؛ آن یکی «وضعیت» است و این یکی «مشخصات».
>
> برنچ: `arena/9adac5a4-fitlytix-foundation` (پایهٔ `cce631a`).

---

# بخش ۱ — بیزینس

## ۱.۱ مسئله

در ایران، ورزشکار آماتور تا نیمه‌حرفه‌ای (کراس‌فیت، بدنسازی، هایروکس، دویدن، فانکشنال) سه انتخاب دارد:

1. برنامهٔ اینترنتی/کپی‌شده — ارزان، بی‌شخصی‌سازی، بدون بازخورد.
2. مربی انسانی — گران (۷٫۵ میلیون تومان در ماه در همین محصول)، محدود به ظرفیت مربی، پاسخ کند.
3. هیچ‌کدام — که رایج‌ترین است.

شکاف واقعی این است: **داده‌ای که ورزشکار هر روز تولید می‌کند (خواب، RPE، جلسهٔ انجام‌شده، تغذیه) هیچ‌جا
به تصمیم تبدیل نمی‌شود.** راه‌حل FitLytix: یک موتور تصمیم که از همان داده شخصی‌سازی می‌کند، هر تصمیم را
توضیح می‌دهد، و یک حلقهٔ بازخورد دارد که پیش‌بینی را با رفتار واقعی مقایسه و اصلاح می‌کند.

## ۱.۲ پرسوناها

| پرسونا            | نقش فنی                | نیاز اصلی                             | آنچه در محصول می‌بیند                                                                        |
| ----------------- | ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| ورزشکار تازه‌کار  | `athlete`              | «نمی‌دانم از کجا شروع کنم»            | ارزیابی → برنامهٔ ۳ ماهه + پایگاه حرکات + مسیر پایه                                          |
| ورزشکار با تجربه  | `athlete`              | «برنامه‌ام با زندگی‌ام نمی‌خواند»     | آرکیتایپ خاص (مثلاً `cf_engine_competition`)، شفافیت `missingFa`، تنظیم بر پایهٔ خواب/آمادگی |
| ورزشکار مسابقه‌ای | `athlete`              | «پیک دقیق»                            | مدت ۶/۱۲ ماه، برنامه‌ریزی مسابقه، پاسپورت ورزشی                                              |
| مربی              | `coach`                | «۶۰ ورزشکار دارم، کدام را اول ببینم؟» | `/coach/attention`، `/coach/data-quality`، `/coach/insights`                                 |
| سر مربی / مدیر    | `head_coach` / `admin` | «کدام آرکیتایپ واقعاً جواب می‌دهد؟»   | `/coach/insights` + دیتاست برچسب‌خورده + بازآموزی                                            |

## ۱.۳ ارزش پیشنهادی و تمایز

1. **پنج رشته با هویت مستقل** (نه یک برنامهٔ عمومی): هر رشته ارزیابی اختصاصی، رنگ، آرکیتایپ و بلوک‌های
   تمرینی خودش را دارد.
2. **توضیح‌پذیری واقعی، نه ادعای توضیح‌پذیری**: `explain.ts` با حذف یک ویژگی و اندازه‌گیری تغییر احتمال
   (ablation واقعی و قابل تکرار) + فهرست ورودی‌هایی که واقعاً اندازه‌گیری شده‌اند. هیچ SHAP جعلی.
3. **گاردریل‌های ایمنی ورزشی** با برچسب فارسی و اقدام مشخص؛ خروجی مدل هرگز بدون فیلتر ایمنی به کاربر نمی‌رسد.
4. **مربی انسانی داخل حلقه**: سه حالت `ai` / `hybrid` / `human` با ارتقای خودکار به حالت انسانی در شرایط
   پرخطر (`minor_athlete` → بازبینی اجباری).
5. **صداقت داده**: هر سیگنال غایب صریحاً اعلام می‌شود؛ دادهٔ ورزشکار از رابط کاربری گرفته و در MySQL
   ذخیره می‌شود، نه پر کردن خاموش.

## ۱.۴ مدل درآمد (آنچه در مخزن هست)

سه پلن ماهانه (`src/mock/plans.ts`، ارز IRR، نمایش تومان):

| پلن             | `coachingType` | قیمت ماهانه (ریال) | وعده                                                                         |
| --------------- | -------------- | ------------------ | ---------------------------------------------------------------------------- |
| AI Coach        | `ai`           | ۱٬۴۹۰٬۰۰۰          | برنامهٔ هفتگی شخصی، Fitness DNA، تنظیم خودکار بر پایهٔ ریکاوری، پایگاه حرکات |
| Hybrid          | `hybrid`       | ۳٬۹۰۰٬۰۰۰          | همهٔ AI + بازبینی هفتگی مربی، تحلیل ویدیو، چت، برنامه‌ریزی مسابقه            |
| Human Coach Pro | `human`        | ۷٬۵۰۰٬۰۰۰          | مربی اختصاصی، برنامه‌نویسی دستی، جلسهٔ ویدیویی ماهانه، پشتیبانی اولویت‌دار   |

زیرساخت: `subscription_plans`, `subscriptions`, `payment_transactions`, `payment_webhook_events` (مهاجرت ۰۰۱).
مسیر خرید: `/plans` → `/checkout`. **وضعیت واقعی: پرداخت شبیه‌سازی‌شده است** (`commerce/service.ts` فقط
مبلغ را از پلن دمو می‌خواند)؛ درگاه واقعی وصل نیست. پکیج‌ها هم در دامنه تعریف شده‌اند:
`training` / `nutrition` / `combined`.

## ۱.۵ قلمرؤ ورزشی

| رشته         | `nameFa`       | شعار                               | بخش‌های ارزیابی                                                   |
| ------------ | -------------- | ---------------------------------- | ----------------------------------------------------------------- |
| CrossFit     | کراس‌فیت       | قدرت، مهارت و موتور در یک برنامه   | warmup, bodybuilding, engine, wod, skill, weightlifting, cooldown |
| Hyrox        | هایراکس        | دویدن و ایستگاه‌های قدرتی استقامتی | running, stations, strength_endurance, pacing                     |
| Functional   | تمرین فانکشنال | حرکت بهتر، بدن کارآمدتر            | movement, mobility, strength, conditioning                        |
| Bodybuilding | بدنسازی        | هایپرتروفی هدفمند و تقارن          | split, volume, lifts, nutrition                                   |
| Running      | دویدن          | سرعت، آستانه و استقامت             | (سکشن‌های دویدن)                                                  |

هر رشته ۴ آرکیتایپ دارد (۲۰ آرکیتایپ کل) — نمونهٔ کراس‌فیت: `cf_foundation`, `cf_strength_skill`,
`cf_engine_competition`, `cf_balanced_performance`.

## ۱.۶ سفر کاربر (۵ قدم تعریف‌شده در `/onboarding`)

| #   | قدم           | مسیر                         | خروجی داده                                        |
| --- | ------------- | ---------------------------- | ------------------------------------------------- |
| ۱   | ارزیابی عمومی | `/assessment/common`         | پروفایل، هدف، سلامت، زمان در دسترس                |
| ۲   | ارزیابی رشته  | `/assessment/sport?sport=…`  | شاخص‌های اختصاصی (strength/engine/skill/mobility) |
| ۳   | Fitness DNA   | `/athlete/fitness-dna`       | پروفایل چندبعدی + نقاط قوت/ضعف                    |
| ۴   | پیشنهاد پلن   | `/plans` → `/recommendation` | آرکیتایپ + تغذیه + مدت + مربیگری + «چرا»          |
| ۵   | عضویت         | `/checkout`                  | اشتراک                                            |

هر قدم یک لایهٔ داده می‌سازد که موتور در قدم ۴ مصرف می‌کند؛ `missingSignals` نشان می‌دهد کدام لایه
ناقص مانده و مدل روی آن حدس زده است.

## ۱.۷ معیارهای موفقیت (تعریف‌شده، قابل اندازه‌گیری)

| معیار             | چطور اندازه می‌گیریم                          | وضعیت ابزار                              |
| ----------------- | --------------------------------------------- | ---------------------------------------- |
| Activation        | ورزشکار تا برنامهٔ واقعی رسیده؟               | `/api/plan` + `recommendation_snapshots` |
| Adherence واقعی   | `recommendation_outcomes.adherence`           | ساخته شده، **صفرداده**                   |
| کیفیت دادهٔ ورودی | امتیاز کیفیت در `/coach/data-quality`         | ساخته شده                                |
| اثربخشی آرکیتایپ  | `/coach/insights` (پایبندی به‌تفکیک آرکیتایپ) | ساخته شده، **صفرداده**                   |
| آمادگی بازآموزی   | `scripts/loop-status.mjs` (آستانه ۲۰۰ برچسب)  | ساخته شده                                |

## ۱.۸ آنچه در بیزینس هنوز ساخته نشده

- درگاه پرداخت واقعی و چرخهٔ اشتراک/تمدید/بازگشت وجه.
- کانال اعلان بیرونی (ایمیل/پیامک/پوش)؛ در دامنه فقط `channel: "in_app"` وجود دارد.
- اپ موبایل (برای Apple Health / Health Connect لازم است؛ `PROVIDER_TRANSPORT` این را صریح می‌گوید).
- پنل مدیریت کسب‌وکار (گزارش درآمد، کوهورت، ریزش).

---

# بخش ۲ — UI/UX

## ۲.۱ زبان بصری

| عنصر            | مقدار                                                                                          | فایل                     |
| --------------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| تم              | تک‌حالتهٔ **تیره** (`color-scheme: dark`، بدون سوییچ روشن)                                     | `src/styles.css`         |
| فونت متن        | `Vazirmatn` (فارسی، RTL)                                                                       | `--font-sans`            |
| فونت تیتر/نمایش | `Space Grotesk` + fallback وزیرمتن                                                             | `--font-display`         |
| شعاع گوشه‌ها    | `--radius: 0.875rem` و مشتقات sm…4xl                                                           | `@theme`                 |
| رنگ اصلی        | `oklch(0.72 0.19 45)` — نارنجی/آمبِر (هویت «اِمبر»)                                            | `--primary`              |
| پس‌زمینه / کارت | `oklch(0.145 …)` / `oklch(0.185 …)` با گرادیان ملایم بالای صفحه                                | `--background`, `--card` |
| وضعیت‌ها        | success / warning / info / destructive به‌صورت توکن معنایی                                     | `--success` …            |
| هویت رشته       | ۵ توکن `--sport-*` (کراس‌فیت نارنجی، هایروکس زرد، فانکشنال فیروزه‌ای، بدنسازی قرمز، دویدن آبی) | `--sport-crossfit` …     |
| بلوک تمرین      | ۷ توکن `--block-*` (warmup, strength, engine, wod, skill, weightlifting, cooldown)             | `--block-warmup` …       |
| نمودارها        | ۵ توکن `--chart-1…5`                                                                           | `--chart-*`              |

اصل UX: **رنگ = معنا**. رنگ رشته در کل صفحه (نوار بالای کارت، آیکن، عنوان) تکرار می‌شود؛ رنگ بلوک
تمرین نوع بلوک را می‌رساند، نه تزئین.

## ۲.۲ RTL و بومی‌سازی

- کل رابط راست‌به‌چپ، با ویژگی‌های منطقی (`ms-`/`me-`/`start-`/`end-`/`ps-`/`pe-`) نه `left/right`.
- اعداد فارسی از طریق `faNumber()` و قیمت با `formatIRR()` (`Intl.NumberFormat("fa-IR")`) — توجه:
  آرگومان دوم `faNumber` گزینه‌های `Intl` است (`{ maximumFractionDigits: n }`)، نه تعداد رقم.
- متن‌های محصول فارسی است ولی نام‌های فنی/برند (CrossFit, Hyrox, Fitness DNA) لاتین می‌مانند.
- الگوی دو‌زبانه در دامنه: هر موجودیت `name` (لاتین) + `nameFa` دارد.

## ۲.۳ کتابخانهٔ اجزا

- **۴۵ پایهٔ shadcn/ui** در `src/components/ui` (dialog, sheet, drawer, tabs, table, form, chart, command,
  calendar, otp, sidebar, sonner…) با Tailwind v4 و توکن‌های CSS.
- **اجزای دامنه** در `src/components/domain`: `assessment`, `athlete`, `body-analysis(-dialog)`, `charts`,
  `coaching`, `data-entry-card`, `exercise-guide`, `health-data`, `plan-summary`, `primitives`,
  `quick-session-card`, `sport`, `workout`.
- **برند**: `Logo.tsx`. **پوسته‌ها**: `AppShell` (اپ)، `MarketingShell` (بازاریابی، با حالت `minimal`).

## ۲.۴ پوستهٔ اپ (`AppShell`)

- سایدبار ورزشکار (۹ آیتم): داشبورد، برنامه، عملکرد، Fitness DNA، تغذیه، ریکاوری، هدف‌ها، سلامت، پاسپورت.
- سایدبار مربی (۹ آیتم): خلاصه، ورزشکاران، نیاز به توجه، دستیار، برنامه‌ها، تغذیه، عملکرد، پایگاه حرکات، پروفایل.
- سوییچ «نمای مربی ↔ نمای ورزشکار» در هدر + دکمهٔ اعلان + نشان
  **«نسخه نمایشی · داده‌های شبیه‌سازی‌شده»** (`MockBadge`) که تا وقتی دادهٔ واقعی نیامده، صداقت را حفظ می‌کند.

## ۲.۵ نقشهٔ صفحات + منبع داده (مهم‌ترین جدول این سند)

| مسیر                                                                                              | چه می‌دهد                                                                                                                                                                                                                          | منبع داده                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                               | صفحهٔ اصلی: هیرو «بدنت را بشناس. مسیرت را بساز.»، کارت ۵ رشته، پلن‌ها                                                                                                                                                              | طرح ثابت + `mock/plans`                                                                                                                                                   |
| `/assessment/common`                                                                              | ارزیابی عمومی چندبخشی با نوار پیشرفت                                                                                                                                                                                               | موتور ارزیابی (`assessment/engine`)                                                                                                                                       |
| `/assessment/sport`                                                                               | ارزیابی اختصاصی رشته، سکشن‌به‌سکشن، درصد تکمیل                                                                                                                                                                                     | `domain/assessment/*`                                                                                                                                                     |
| `/recommendation`                                                                                 | پیشنهاد آرکیتایپ/تغذیه/مدت/مربیگری + «چرا این برنامه»                                                                                                                                                                              | **واقعی: `/api/recommend` + مدل**                                                                                                                                         |
| `/plans`, `/checkout`                                                                             | سه پلن و مسیر خرید                                                                                                                                                                                                                 | `mock/plans` (پرداخت شبیه‌سازی)                                                                                                                                           |
| `/onboarding`                                                                                     | نقشهٔ ۵ قدمی سفر                                                                                                                                                                                                                   | ثابت                                                                                                                                                                      |
| `/athlete/program`                                                                                | برنامهٔ فعلی: آرکیتایپ، جلسات/هفته، دقیقه، مدت، تغذیه، حالت مربیگری، پایبندی پیش‌بینی‌شده، سطح ایمنی، `archetypeSummaryFa` + **`missingFa`/`sourcesFa`** + تایم‌لاین هفته + **کارت «جلسهٔ امروز»** + **کارت «ثبت داده‌های امروز»** | **واقعی: `/api/plan` + `/api/logs`**                                                                                                                                      |
| `/athlete/dashboard`                                                                              | اسنپ‌شات روزانه: برنامه + تغذیه + مربیگری + ریکاوری                                                                                                                                                                                | **واقعی: `/api/plan` + `/api/athlete/overview`** (تمرکز، جلسهٔ بعدی، برنامهٔ چرخه، ریکاوری از چک‌این، شمارش ۲۸ روزه، جلسات اخیر) · `mock` فقط در رادار DNA و بستهٔ نمایشی |
| `/athlete/fitness-dna`                                                                            | پروفایل چندبعدی (نقاط قوت/ضعف)                                                                                                                                                                                                     | `mock/athlete`                                                                                                                                                            |
| `/athlete/performance`                                                                            | روند عملکرد و نمودارها                                                                                                                                                                                                             | `mock/athlete`                                                                                                                                                            |
| `/athlete/nutrition`                                                                              | برنامهٔ تغذیه، روزهای تمرین/استراحت، فیدبک                                                                                                                                                                                         | `mock/athlete`                                                                                                                                                            |
| `/athlete/recovery`                                                                               | آمادگی، عوامل، تاریخچه                                                                                                                                                                                                             | **واقعی: `/api/athlete/overview`** (امتیاز از چک‌این خودِ ورزشکار، نمودار خواب/تنش/وزن، جدول چک‌این‌ها)                                                                   |
| `/athlete/health`                                                                                 | اتصال پوشیدنی‌ها + ورود دستی متریک‌ها                                                                                                                                                                                              | `mock/health-data` + `domain/platform` (متریک‌های مجاز)                                                                                                                   |
| `/athlete/goals`                                                                                  | هدف + مراحل + وضعیت مسیر                                                                                                                                                                                                           | `mock/athlete`                                                                                                                                                            |
| `/athlete/passport`                                                                               | پاسپورت ورزشی (PRها، بنچمارک‌ها، مهارت‌ها)                                                                                                                                                                                         | `mock/athlete`                                                                                                                                                            |
| `/coach`                                                                                          | خلاصهٔ مربی + لینک به دو صفحهٔ تحلیلی جدید                                                                                                                                                                                         | `mock/coach` + لینک‌ها                                                                                                                                                    |
| `/coach/athletes`, `/coach/athlete/:id`                                                           | فهرست/پروفایل ورزشکار                                                                                                                                                                                                              | `mock/coach`                                                                                                                                                              |
| `/coach/attention`                                                                                | «چه کسی نیاز به توجه دارد» با دلیل و اقدام                                                                                                                                                                                         | **واقعی: `/api/coach/attention`** (همان قواعد نودج ورزشکار، با نقشهٔ مربی)                                                                                                |
| `/coach/assistant`                                                                                | پیشنهادهای AI با وضعیت draft/needs_review/approved/rejected                                                                                                                                                                        | `mock/coach`                                                                                                                                                              |
| `/coach/programs`, `/coach/nutrition`, `/coach/performance`, `/coach/exercises`, `/coach/profile` | مدیریت و پایگاه حرکات                                                                                                                                                                                                              | `mock/coach` / `mock/exercise-education`                                                                                                                                  |
| **`/coach/data-quality`**                                                                         | جدول کیفیت دادهٔ هر ورزشکار + فرمول امتیاز روی صفحه                                                                                                                                                                                | **واقعی: `/api/coach-insights`**                                                                                                                                          |
| **`/coach/insights`**                                                                             | پایبندی واقعی هر آرکیتایپ                                                                                                                                                                                                          | **واقعی: `/api/coach-insights`**                                                                                                                                          |
| `/login`, `/register`                                                                             | ورود/ثبت‌نام                                                                                                                                                                                                                       | **واقعی: `/api/auth/*`**                                                                                                                                                  |

### چرا «بازتولید» برنامه را عوض نمی‌کرد؟

موتور قطعی است: ورودی یکسان ⇒ برنامهٔ یکسان. این همان چیزی است که «برنامهٔ ذخیره‌شده» را قابل
بازتولید می‌کند، ولی یک دکمهٔ بی‌قید «بازتولید» را بی‌اثر می‌کرد. حالا:

- `/athlete/program` بخش **«تغییر برنامه»** دارد: طول دوره (۱/۳/۶/۱۲ ماه) و سقف جلسه در هفته.
- پاسخ `POST /api/plan` فیلد `meta.changesFa` دارد (تفاوت با اسنپ‌شات قبلی) و رابط همان را نشان می‌دهد.
- اگر تنظیمی عوض نشده باشد، صریح می‌گوید «برنامه عوض نشد» و می‌گوید چه چیزی آن را عوض می‌کند.
- سنجش: `node scripts/plan-variance.test.mjs` در برابر یک نمونهٔ محلی (۴ ادعا).

> این جدول تنها مرجع «چه چیزی دمو است» است. هر صفحهای که `mock/` وارد می‌کند، با `MockBadge` علامت
> خورده و نباید به‌عنوان دادهٔ واقعی به کاربر یا سرمایه‌گذار ارائه شود.

## ۲.۶ جریان‌های کلیدی و حالت‌هایشان

**الف) از ارزیابی تا برنامه.** ارزیابی → `POST /api/recommend` (بدون ذخیره) → صفحهٔ پیشنهاد با «چرا» →
`POST /api/plan` (ذخیرهٔ اسنپ‌شات + خروجی برنامه). حالت‌ها: `loading` (اسکلتون)، `unauthorized` (دعوت به
ورود)، `error` (پیام فارسی + تلاش دوباره)، `empty` (وقتی ارزیابی ناقص است → دعوت به تکمیل).

**ب) شفافیت داده در `/athlete/program`.** دو فهرست کنار هم: `sourcesFa` (چه چیزی اندازه‌گیری شد) و
`missingFa` (چه چیزی نبود و مدل جای آن N/A گذاشت). این تنها جای محصول است که کاربر می‌تواند ببیند
«چرا برنامه‌ام این است» بدون خواندن مستندات.

**ج) ثبت دادهٔ روزانه.** کارت «جلسهٔ امروز»: دو دکمهٔ بزرگ (انجام دادم / امروز تمرین نکردم) + RPE.
کارت کامل: سه تب (تمرین / تغذیه / چک‌این روزانه)؛ چک‌این شامل خواب، کیفیت خواب، استرس، آمادگی، وزن،
ضربان استراحت، یادداشت. پس از هر ثبت: `POST /api/logs` → برچسب‌گذاری خودکار `recommendation_outcomes`
→ بازسازی برنامه با `{force:true}`.

**د) نمای مربی.** `/coach` → بنر «دادهٔ کافی نیست» یا لینک به دو صفحه؛ `/coach/data-quality` جدول با
مرتب‌سازی بر امتیاز کیفیت؛ `/coach/insights` جدول آرکیتایپ با پایبندی واقعی. هر دو صفحه، حالت خالی
صادق دارند («هنوز داده‌ای ثبت نشده، به ورزشکاران یادآوری کنید») نه اعداد تزئینی.

**ه) ورود/ثبت‌نام.** خطاهای صریح: ۴۰۱ «ایمیل یا رمز عبور صحیح نیست»، ۴۰۳ «حساب غیرفعال»،
۴۰۹ «این ایمیل قبلاً ثبت شده». کوکی `fitlytix_session` با `HttpOnly`, `SameSite=Lax`, و `Secure`
در محیط تولید.

## ۲.۷ بدهی UX شناخته‌شده

- سوییچ تم روشن وجود ندارد (تصمیم طراحی، ولی درخواست کاربران دیده نشده).
- ویجت‌های داشبورد ورزشکار هنوز دمو هستند؛ ناهمخوانی «برنامهٔ واقعی + ویجت دمو» در یک صفحه.
- اعلان‌ها فقط آیکن بدون مرکز اعلان واقعی.
- حالت `loading` یکسان در همهٔ صفحات نیست؛ بعضی از `skeleton` استفاده نمی‌کنند.
- بازخورد خطای شبکه در کارت‌های ثبت داده به toast محدود است (بدون تلاش دوبارهٔ خودکار).

---

# بخش ۳ — تکنیکال

## ۳.۱ استک و اجرا

| مورد     | مقدار                                                                             |
| -------- | --------------------------------------------------------------------------------- |
| فریم‌ورک | TanStack Start (file-based routes) + Vite + Nitro                                 |
| زبان     | TypeScript strict؛ مسیرهای `@/…`                                                  |
| استایل   | Tailwind CSS v4 + توکن‌های `oklch` در `src/styles.css`                            |
| دیتابیس  | MySQL 8.0.46، `mysql2/promise`، استخر اتصال، کوئری پارامتری                       |
| مدل      | GBDT (sklearn) → JSON؛ استنتاج TS درون‌پروسه                                      |
| میزبانی  | cPanel/Passenger، `~/public_html/fitlytix-app`                                    |
| دستورها  | `npm run build`, `npm run e2e:plan`, `npm run verify:prod`, `npm run loop:status` |

## ۳.۲ ساختار

```
src/routes/            صفحات + api/*
src/components/{ui,domain,layout,brand}
src/domain/            انواع و ثابت‌های دامنه (sports, platform, recommendation, assessment/*)
src/services/          15 سرویس دامنه (پایین‌تر)
src/services/recommendation/  موتور: features, ensemble, engine, guardrails, explain, snapshots, outcomes
src/lib/              db.server, auth.server
src/mock/             داده دمو (۷ فایل) — علامت‌دار
database/migrations/mysql/  001…007
ml/                   train.py + fitlytix_ml (فقط آموزش)
scripts/              deploy, daily-export, export-dataset, retrain, loop-status, parity, e2e, password
docs/                 این سند + brief + runbook + data loop + code map
```

۱۵ سرویس: `assessment`, `body-analysis`, `coach`, `coaching`, `commerce`, `decision-engine`,
`fitness-dna`, `goals`, `health-data`, `notifications`, `nutrition`, `performance`, `program`,
`recommendation`, `athlete`, `ai-coaching`.

## ۳.۳ مدل داده

| مهاجرت | جدول‌ها                                                                                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ۰۰۱    | `schema_migrations`, `training_programs`, `training_sessions`, `workout_items`, `workout_logs`, `workout_feedback`, `nutrition_plans`, `nutrition_logs`, `ai_coaching_runs`, `subscription_plans`, `subscriptions`, `payment_transactions`, `payment_webhook_events`, `wearable_connections`, `wearable_sync_logs`, `audit_logs` |
| ۰۰۲    | `users`, `user_sessions`, `sports`, `athlete_profiles`, `assessments`, `assessment_answers`, `body_analysis_records`, `health_metrics`                                                                                                                                                                                           |
| ۰۰۳    | `recommendation_events`, `recommendation_outcomes`, `model_registry`                                                                                                                                                                                                                                                             |
| ۰۰۴    | `recommendation_snapshots` (ورودی، بردار ۵۶تایی، `used_signals`/`missing_signals`, اقدام، نسخهٔ مدل)                                                                                                                                                                                                                             |
| ۰۰۵    | `recommendation_snapshots.seq` (ترتیب قطعی «آخرین اسنپ‌شات»)                                                                                                                                                                                                                                                                     |
| ۰۰۶    | `athlete_checkins` + ستون‌های برچسب در `recommendation_outcomes` (پنجره، تغذیه، RPE، دورهٔ کامل، پیشرفت)                                                                                                                                                                                                                         |
| ۰۰۷    | هم‌ترازی جدول قدیمی `users`: `role`, `status`, `first_name`, `last_name`, `phone`, `created_at`, `updated_at` + `password_hash VARCHAR(255)`                                                                                                                                                                                     |

نکتهٔ عملیاتی: مهاجرت‌ها **additive** هستند و هیچ‌چیز را حذف نمی‌کنند؛ ۰۰۷ برای پایگاه‌داده‌ای نوشته شد
که جدول `users` را از قبل داشت (مهاجرت ۰۰۲ با `IF NOT EXISTS` از آن رد شده بود).

## ۳.۴ API

| مسیر                                        | دسترسی                       | قرارداد                                                     |
| ------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `POST /api/auth/register`                   | عمومی                        | ۴۰۰ اعتبارسنجی، ۴۰۹ ایمیل تکراری                            |
| `POST /api/auth/login`                      | عمومی                        | ۴۰۱ رمز/ایمیل، ۴۰۳ غیرفعال؛ کوکی نشست                       |
| `POST /api/auth/logout`, `GET /api/auth/me` | کاربر                        | `{ok, authenticated, user}`                                 |
| `POST /api/plan`                            | ورزشکار                      | `{force:true}` بازسازی؛ ذخیرهٔ اسنپ‌شات                     |
| `POST /api/recommend`                       | عمومی/ورزشکار                | پیشنهاد بدون ذخیره (پیش‌نمایش)                              |
| `GET/POST /api/logs`                        | ورزشکار                      | سه نوع discriminated union: `session`/`nutrition`/`checkin` |
| `GET /api/coach-insights`                   | `coach`/`head_coach`/`admin` | `{summary, athletes[], archetypes[]}`                       |
| `GET /api/plan-diagnose`                    | مربی/مدیر                    | وضعیت مهاجرت + اسنپ‌شات؛ **بدون دادهٔ حساس**                |
| `GET /api/dataset-export?token=`            | توکن محیطی                   | NDJSON + هدرهای `x-dataset-*`؛ خطاها JSON با ۵۰۰            |
| `GET /api/health`, `GET /api/db-test`       | عمومی                        | زنده‌بودن؛ `db-test` شمارش جدول‌ها                          |

قواعد مشترک: `cache-control: no-store` در همهٔ پاسخ‌های کاربری، خطای JSON با پیام فارسی، پیام خطای
فنی فقط در لاگ سرور.

## ۳.۵ موتور هوش مصنوعی

### آرتیفکت

`format: fitlytix-gbdt-json`، نسخه `2026.11.11-cce631a`، `trainingData: simulated`، ۴۸٬۰۰۰ ردیف
(۳۸٬۴۰۰/۹٬۶۰۰)، `seed 42`، ۵۶ ویژگی، ۱٬۳۰۷٬۱۶۴ بایت، `sha256 2500a09c…`.
پاریتی TS↔sklearn روی ۲۰۰ فیکسچر: بیشینه خطای مطلق `2.6e-6` (بدترین سربرگ: duration).

### ۵۶ ویژگی در ۷ گروه

| گروه                 | تعداد | ویژگی‌ها                                                                                                                                                                                         |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| رشته و پروفایل       | ۱۴    | `sport_*` (۵ one-hot), `experience_rank`, `training_age_years`, `age`, `sex_male`, `height_cm`, `weight_kg`, `bmi`, `body_fat_pct`, `body_fat_available`                                         |
| اهداف و ترجیحات      | ۱۰    | `goal_strength`, `goal_muscle`, `goal_fat_loss`, `goal_endurance`, `goal_competition`, `goal_health`, `wants_mobility`, `wants_recovery`, `wants_consistency`, `wants_skill`                     |
| محدودیت‌ها           | ۶     | `sessions_available`, `session_minutes`, `equipment_score`, `environment_rank`, `activity_level`, `work_style_rank`                                                                              |
| آمادگی و سبک زندگی   | ۷     | `sleep_hours`, `sleep_quality`, `stress`, `pain_severity`, `pain_area_count`, `readiness_avg`, `wearable_connected`                                                                              |
| شاخص‌های عملکرد      | ۷     | `strength_index`, `strength_available`, `engine_index`, `engine_available`, `skill_index`, `mobility_index`, `weekly_mileage`                                                                    |
| تاریخچهٔ رفتاری      | ۹     | `adherence_28d`, `adherence_available`, `avg_rpe`, `rpe_trend`, `missed_sessions_28d`, `sessions_completed_28d`, `feedback_completeness`, `nutrition_adherence`, `nutrition_adherence_available` |
| مسیر و سابقهٔ برنامه | ۳     | `days_since_signup`, `prior_plan_months`, `prior_plan_count`                                                                                                                                     |

الگوی مهم: برای هر سیگنال کلیدی یک `*_available` وجود دارد؛ یعنی «نبودِ داده» خودش یک ویژگی است و
مدل می‌تواند بین «خواب ۷ ساعت» و «خواب نامعلوم» تفاوت بگذارد. این کلید صداقت داده است.

### خروجی‌ها و کیفیت (مجموعهٔ آزمون شبیه‌سازی)

| سربرگ                  | نوع     | معیار    | مدل               | خط مبنا |
| ---------------------- | ------- | -------- | ----------------- | ------- |
| برنامه (به‌تفکیک رشته) | ۴ کلاس  | accuracy | ۰٫۸۵۱۴ (کراس‌فیت) | ۰٫۴۷۱۲  |
| تغذیه                  | ۵ کلاس  | accuracy | ۰٫۹۴۰۶            | ۰٫۲۹۶۹  |
| مدت                    | ۴ کلاس  | accuracy | ۰٫۷۳۸۵            | ۰٫۵۱۴۷  |
| مربیگری                | ۳ کلاس  | accuracy | ۰٫۷۸۰۵            | ۰٫۵۲۰۹  |
| جلسات/هفته             | رگرسیون | MAE / R² | ۰٫۲۵۴۷ / ۰٫۸۳۳۷   | —       |
| پایبندی                | رگرسیون | MAE / R² | ۰٫۰۶۵۷ / ۰٫۷۹۷۵   | —       |

این اعداد **درستی کد** را نشان می‌دهند، نه اعتبار برای جمعیت واقعی.

### گاردریل‌ها

`low_sleep`, `high_stress`, `low_readiness`, `low_adherence`, `underweight`, `minor_athlete`
(`review_required`)، `high_volume_cap`, `nutrition_risk`. هر فلگ: `labelFa` + `actionFa` + `severity`
(`info`/`caution`/`review_required`). اقدام‌ها: کاهش حجم هفته، کوتاه‌کردن دوره، بالا بردن حالت مربیگری،
تغییر هدف تغذیه، سقف جلسات.

### توضیح‌پذیری

`explain.ts` دو چیز می‌دهد: (۱) حساسیت محلی واقعی با ablation یک ویژگی در برابر میانهٔ آموزش،
(۲) فهرست ورودی‌های نام‌دارِ اندازه‌گیری‌شده. هیچ SHAP یا اهمیت ویژگی جعلی ساخته نمی‌شود.

## ۳.۶ حلقهٔ داده

```
snapshot → ثبت رفتار (sessions/nutrition/checkins) → outcomes → dataset-export →
loop-status (آستانه ۲۰۰) → retrain.mjs (Python، لوکال/CI) → parity → دپلوی آرتیفکت
```

| ابزار                        | کار                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/logs`             | ثبت سه‌نوع داده + `labelOutcomesForUser`                                        |
| `GET /api/dataset-export`    | NDJSON + هدرهای `x-dataset-rows/labelled/behaviour`؛ ردیف خراب → `skipped`      |
| `scripts/export-dataset.mjs` | گزارش کیفیت (`labelledShare`, `behaviourCoverage`, میانه/میانگین پایبندی)       |
| `scripts/loop-status.mjs`    | بدون پایتون: ردیف/برچسب، پایبندی هر آرکیتایپ، سیگنال‌های کم، فاصله تا ۲۰۰       |
| `scripts/retrain.mjs`        | **زیر ۲۰۰ برچسب امتناع می‌کند**؛ بالای آن: calibration + `ml/train.py` + parity |
| `scripts/daily-export.sh`    | نمونهٔ موقت روی `EXPORT_PORT=3998`، نگهداشت ۱۴ فایل، توکن یک‌بارمصرف            |

## ۳.۷ دپلوی و بهره‌برداری

`bash scripts/deploy-cpanel.sh [--with-migrations] [--no-backup] [--prune] [--dry-run]`
→ پشتیبان → دریافت کد → `npm ci` → بیلد → (مهاجرت) → ری‌استارت Passenger → افزودن یک‌بارهٔ
`PassengerAppLogFile` → (`--prune`: حذف `node_modules`).

کرون شبانه: `10 3 * * * … bash scripts/daily-export.sh >> $HOME/logs/dataset-export.log 2>&1`

## ۳.۸ امنیت

- رمز: `scrypt` با نمک تصادفی ۱۶ بایتی، `scrypt$<salt>$<hex>`، مقایسهٔ `timingSafeEqual`؛
  `verifyPassword()` علاوه بر آن `salt:hash` و `sha256` را هم می‌پذیرد، ولی **argon2 را نه**.
  جدول `users` با یک اپ قدیمی مشترک است و حساب‌های قدیمی هش `$argon2…` دارند → تا بازنشانی، ورودشان ۴۰۱ است.
  بازنشانی: `bash scripts/set-password.sh --role coach` (مستقیم روی دیتابیس، بدون phpMyAdmin).
- نشست: توکن امضاشده با HMAC-SHA256 + ردیف در `user_sessions` (قابل ابطال)، ۳۰ روز، `HttpOnly`.
- RBAC: `requireRole(["coach","head_coach","admin"])` در APIهای مربی.
- دیتاست: توکن محیطی، فقط روی نمونهٔ موقتِ صادرکننده فعال میشود، نه روی اپ اصلی.
- `plan-diagnose` هیچ دادهٔ کاربری برنمی‌گرداند.

## ۳.۹ محدودیت‌های محیط (تجربه‌شده روی همین هاست)

1. `information_schema` ممنوع (`#1044`): فقط `SHOW TABLES` / `SHOW COLUMNS`.
2. پایتون روی هاست نیست → آموزش لوکال/CI.
3. MySQL 8 (نه MariaDB) → `ADD COLUMN IF NOT EXISTS` نداریم؛ idempotency با `CONTINUE HANDLER FOR 1060`.
4. phpMyAdmin تب سرور: `#1046` → نام کامل اسکیما.
5. `CREATE ROUTINE` ممکن است مجاز نباشد → نسخهٔ ALTER مستقیم.
6. ترمینال SSH شکننده → دستور تک‌خطی، بدون placeholder، بعد از برگشت prompt.
7. اپ به دامنهٔ خودش curl نمی‌زند → تأیید از مرورگر.

## ۳.۱۰ کیفیت و تست

| ابزار                            | پوشش                                                                |
| -------------------------------- | ------------------------------------------------------------------- |
| `tsc --noEmit` + eslint          | همهٔ فایل‌های دست‌خورده، بدون خطا                                   |
| `npm run build`                  | بیلد Nitro + بازبینی مسیرها                                         |
| `scripts/check-model-parity.mjs` | ۲۰۰ فیکسچر، ۶ سربرگ + invariances                                   |
| `scripts/e2e-plan.mjs`           | ۱۴ بررسی end-to-end روی نمونهٔ محلی (ثبت‌نام، برنامه، لاگ، دیاگنوز) |
| `scripts/verify-prod.mjs`        | بررسی استاتیک خروجی بیلد                                            |

**شکاف تست:** مسیر ورود (login/session) تست خودکار ندارد؛ همین باعث شد خرابی ۴۰۱ چند مرحله طول بکشد.

## ۳.۱۱ وضعیت و بدهی فنی

تأییدشده: بیلد (از جمله روی هاست با `--low-mem`)، تایپ/لینت، پاریتی، مهاجرت ۰۰۶/۰۰۷،
`PassengerAppLogFile`, `--prune`, ساخت دیتاست، ورود، و دو صفحهٔ دادهٔ واقعی
(`/athlete/dashboard` و `/coach/attention`).
تأیید نشده: `POST /api/logs` از UI، نمایش دو صفحهٔ جدید با دادهٔ واقعی در مرورگر، کرون شبانه،
بازآموزی واقعی.

بدهی فنی: صفحات مبتنی بر `mock/` (۱۲ مسیر)، نبود تست برای auth، نبود CI، نبود مرکز اعلان، پرداخت
شبیه‌سازی، `src/routes/README.md` قدیمی.

---

# بخش ۴ — نقشهٔ راه پیشنهادی

| فاز      | محتوا                                                                            | معیار پایان                                         |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| ۱ (فوری) | بستن ورود: دپلوی بیلد اصلاح‌شده، بازنشانی رمز، نقش `coach`، تأیید `/api/db-test` | ورود و ماندن نشست در مرورگر                         |
| ۲        | اولین دادهٔ واقعی + یادآور ورزشکار رهاشده (۳ جلسهٔ متوالی)                       | `labelled > 0` و رشد هفتگی                          |
| ۳        | جایگزینی تدریجی `mock/` با دادهٔ دیتابیس، صفحه‌به‌صفحه (شروع: داشبورد ورزشکار)   | حذف `MockBadge` از مسیرهای ورزشکار                  |
| ۴        | بازآموزی واقعی در ۲۰۰ برچسب + پرداخت واقعی + اعلان بیرونی                        | مدل با `trainingData: real`، درآمد قابل اندازه‌گیری |
