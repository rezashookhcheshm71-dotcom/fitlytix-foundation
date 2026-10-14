# مستند جامع پروژه FitLytix — وضعیت نسخه اولیه، تغییرات اعمال‌شده و نقشه کامل مسیرها و فایل‌ها

**تاریخ تدوین:** ۲۲ مهر ۱۴۰۵ (`2026-10-14`)  
**مخزن گیت‌هاب:** `https://github.com/rezashookhcheshm71-dotcom/fitlytix-foundation`  
**آدرس سرور پروداکشن:** `https://app.fitlytix.ir`  
**مسیر پروژه روی سرور cPanel:** `/home/eugtezmj/public_html/fitlytix-app`  
**دیتابیس پروداکشن MySQL:** `eugtezmj_fitlytix`

---

## بخش اول: نسخه اولیه چه بود؟ (وضعیت قبل از بازیابی و یکپارچه‌سازی)

در بررسی کامل تاریخچه گیت، شاخه‌ها (`branches`) و مقایسه با سرور پروداکشن (`app.fitlytix.ir`)، وضعیت نسخه اولیه به شکل زیر بود:

### ۱. وضعیت شاخه‌ها در گیت‌هاب
1. **شاخه `main` (کامیت `60f68fd` — تاریخ ۱۰ اکتبر ۲۰۲۶):**
   - ساختار فرانت‌اند و صفحات اصلی با **React 19 + TypeScript + TanStack Start / Router + Tailwind CSS v4** ساخته شده بود.
   - فایل استارتاپ `app.js` برای cPanel Passenger و مسیر سلامت `src/routes/api/health.ts` اضافه شده بود.
   - **مشکل ۱ (عدم اتصال به MySQL در گیت‌هاب):** در شاخه `main` گیت‌هاب، هیچ‌کدام از فایل‌های سرور MySQL (`src/lib/db.server.ts`، `src/lib/auth.server.ts`، `src/server/athlete.repository.ts` و APIهای احراز هویت/ارزیابی) وجود نداشتند.
   - **مشکل ۲ (وابستگی به Supabase در کدهای گیت‌هاب):** فایل‌های `src/lib/supabase.ts`، `src/lib/auth.ts`، `src/routes/login.tsx` و `src/routes/register.tsx` هنوز به `@supabase/supabase-js` متصل بودند و در صورت نبودن متغیرهای `VITE_SUPABASE_URL` خطا می‌دادند.
   - **مشکل ۳ (ذخیره‌سازی نمایشی و شناسه هاردکد شده `ath_001`):** صفحات `src/routes/assessment.common.tsx` و `src/routes/assessment.sport.tsx` پاسخ‌ها را با شناسه ثابت `"ath_001"` به متد ماک `assessmentEngine.submit("ath_001", ...)` می‌فرستادند و هیچ داده‌ای در MySQL ذخیره نمی‌شد (و نشانگر `«ذخیره‌سازی هنوز متصل نیست»` نمایش داده می‌شد).
2. **شاخه `feat/mysql-core-schema` (کامیت `464d6ed` — PR شماره ۱):**
   - شامل فایل مهاجرت افزایشی `database/migrations/mysql/001_fitlytix_product_domains.sql` (جداول برنامه تمرینی، جلسات، لاگ تمرین، بازخورد، تغذیه، اجرای هوش مصنوعی، اشتراک، تراکنش‌های پرداخت، پوشیدنی‌ها و لاگ ممیزی) و راهنمای `database/migrations/README.md` بود اما هنوز با شاخه `main` ادغام (`merge`) نشده بود.
3. **ناهمگامی سرور cPanel با گیت‌هاب و حذف ناخواسته کدهای مرحله سوم ارزیابی:**
   - روی سرور cPanel تغییرات اتصال به دیتابیس MySQL (`eugtezmj_fitlytix` با ۴۰ جدول و مسیر `/api/db-test`) به صورت مستقیم اعمال شده بود اما به گیت‌هاب Push نشده بود.
   - هنگام ویرایش فایل `src/routes/assessment.common.tsx`، بخش مربوط به **گام سوم ارزیابی عمومی** دچار حذف ناخواسته شده بود.

---

## بخش دوم: چه کارهایی انجام شد؟ (خلاصه تمام تغییرات اعمال‌شده)

### ۱. بازیابی کامل کدهای حذف‌شده در `src/routes/assessment.common.tsx` (اولویت P0)
- ساختار کامل صفحه ارزیابی عمومی (`CommonAssessment`) شامل هر ۳ گام ورودی بازیابی و تثبیت شد:
  1. **گام ۱ — بخش‌های پنج‌گانه پرسشنامه عمومی (`COMMON_ASSESSMENT.sections` در `src/domain/assessment/common.ts`):**
     - بخش ۱ (`common.about`): سن، قد، وزن، سابقه تمرین منظم
     - بخش ۲ (`common.direction`): هدف اصلی، هدف دوم، تعداد جلسات هفتگی، مدت هر جلسه
     - **بخش ۳ (`common.life` — روزمره و امکانات):** سبک کار روزانه، فعالیت خارج از تمرین، محل تمرین، تجهیزات در دسترس
     - بخش ۴ (`common.recovery`): ساعت خواب، کیفیت بیداری، فشار روزانه، حس بدن، وضعیت درد/آسیب و نواحی محدودیت
     - بخش ۵ (`common.coach_note`): یادداشت آزاد برای مربی
  2. **گام ۲ — ورودی آنالیز بدن (`<BodyAnalysisIntake />`):** ثبت اختیاری داده‌های InBody یا اندازه‌گیری دستی (وزن، درصد چربی، توده عضلانی و تحلیل سگمنتال).
  3. **گام ۳ — ورودی ساعت هوشمند و سنسورهای سلامت (`<WearableIntake />`):** انتخاب وضعیت استفاده از گجت پوشیدنی (`yes` / `no` / `manual`) و انتخاب سرویس‌ها (`Garmin`, `Apple Health`, `Google Health Connect`, `WHOOP`, `Oura`, `Polar`, `Fitbit`, `Samsung Health`, `سایر`).

### ۲. پیاده‌سازی لایه دیتابیس MySQL و احراز هویت سرور (`fitlytix_session`) (اولویت P1)
- **ادغام شاخه `feat/mysql-core-schema`** در `main` و افزودن پکیج `mysql2` به `package.json`.
- **ایجاد `database/migrations/mysql/002_fitlytix_core_auth_assessments.sql`:** مهاجرت کاملاً افزایشی (`CREATE TABLE IF NOT EXISTS`) برای جداول پایه (`users`, `user_sessions`, `sports`, `athlete_profiles`, `assessments`, `assessment_answers`, `body_analysis_records`, `health_metrics`) و ثبت ایمن ۵ رشته ورزشی اصلی (`crossfit`, `hyrox`, `functional`, `bodybuilding`, `running`) بدون حذف یا تغییر داده‌های موجود.
- **ایجاد `src/lib/db.server.ts`:**
  - اتصال ایمن به MySQL با `mysql2/promise` صرفاً از طریق متغیرهای محیطی (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
  - قابلیت تشخیص خودکار ستون‌های جدول‌ها از طریق `INFORMATION_SCHEMA.COLUMNS` (کش‌شده در حافظه) تا کدها با ساختار دقیق ۴۰ جدول موجود در دیتابیس پروداکشن `eugtezmj_fitlytix` کاملاً سازگار باشند.
- **ایجاد `src/lib/auth.server.ts`:**
  - مدیریت نشست سمت سرور با کوکی استاندارد `fitlytix_session` (`HttpOnly`, `SameSite=Lax`, `Secure` در محیط پروداکشن).
  - هش کردن امن رمز عبور با `scrypt` (`node:crypto`) و مقایسه مقاوم در برابر حملات زمانی (`timingSafeEqual`).
  - ذخیره و اعتبارسنجی نشست‌ها در جدول `user_sessions` به همراه امضای رمزنگاری‌شده HMAC-SHA256.

### ۳. ذخیره‌سازی واقعی ارزیابی عمومی و تخصصی در MySQL (`src/server/athlete.repository.ts` و `/api/assessment`)
- **حذف کامل شناسه هاردکد شده `"ath_001"`** از مسیرهای ثبت ارزیابی در `src/routes/assessment.common.tsx`، `src/routes/assessment.sport.tsx` و `src/services/assessment/engine.ts`.
- **استخراج شناسه ورزشکار صرفاً از نشست معتبر سرور (`fitlytix_session`):** هیچ درخواستی از سمت کلاینت نمی‌تواند شناسه ورزشکار دیگری را جعل یا ویرایش کند.
- **نگاشت خودکار رشته ورزشی (`resolveSportId`):** تبدیل اسلاگ رشته‌ها (`crossfit`, `hyrox`, `functional`, `bodybuilding`, `running`) به شناسه واقعی `sports.id` در دیتابیس MySQL.
- **ذخیره هم‌زمان در یک جریان یکپارچه:**
  - ذخیره پاسخ‌های ارزیابی عمومی و تخصصی در جدول `assessments` (و `assessment_answers` در صورت وجود) با وضعیت `submitted` و زمان دقیق تکمیل (`completed_at`).
  - به‌روزرسانی پروفایل پایه ورزشکار (`athlete_profiles` / `athletes`) شامل سن، قد، وزن، سابقه تمرین، رشته اصلی و سطح تجربه.
  - ذخیره رکورد آنالیز بدن (گام ۲ ارزیابی عمومی) به صورت افزایشی در جدول `body_analysis_records`.
  - ذخیره انتخاب ساعت هوشمند و سرویس‌های پوشیدنی (گام ۳ ارزیابی عمومی) در جدول `wearable_connections` با وضعیت `pending`.
- **حفظ پیش‌نویس پاسخ‌ها در `sessionStorage`:** اگر کاربر قبل از ورود به حساب فرم ارزیابی را پر کند، پاسخ‌هایش در مرورگر حفظ می‌شود و بلافاصله پس از ورود یا ثبت‌نام، به همان صفحه ارزیابی برمی‌گردد تا در دیتابیس ذخیره شود.

### ۴. یکپارچه‌سازی ثبت‌نام و ورود (`src/routes/register.tsx` و `src/routes/login.tsx`)
- ثبت‌نام (`POST /api/auth/register`) بلافاصله کاربر و پروفایل ورزشکار را در MySQL می‌سازد و کوکی نشست `fitlytix_session` را ست می‌کند (بدون نیاز به ورود مجدد).
- پشتیبانی از پارامتر `?redirect=` در صفحات `/login` و `/register` برای بازگشت خودکار به صفحه ارزیابی پس از احراز هویت.

---

## بخش سوم: راهنمای کامل تمام مسیرها و فایل‌های پروژه (Directory & File Map)

در ادامه، فهرست کامل تمام پوشه‌ها و فایل‌های پروژه به همراه وظیفه دقیق هر فایل آورده شده است:

### ۱. فایل‌های ریشه پروژه (Root Configuration)
| مسیر فایل | توضیح و نقش در پروژه |
|---|---|
| `app.js` | فایل ورودی اجرای برنامه در cPanel / Passenger که باندل سرور `.output/server/index.mjs` را اجرا می‌کند. |
| `package.json` | تعریف اسکریپت‌های بیلد و اجرا (`dev`, `build`, `start`, `verify:prod`) و وابستگی‌ها از جمله `mysql2`, `@tanstack/react-start`, `react`, `zod`. |
| `vite.config.ts` | تنظیمات Vite و TanStack Start با خروجی `nitro: { preset: "node-server" }` برای اجرای مستقل روی Node.js 22 در cPanel. |
| `.env.example` | الگوی متغیرهای محیطی سرور (`NODE_ENV`, `PORT`, `HOST`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`). |
| `scripts/verify-prod.mjs` | اسکریپت تست سلامت سرور پروداکشن برای بررسی پاسخ `HTTP 200` مسیرهای اصلی. |

### ۲. مهاجرت‌های دیتابیس (`database/` و `docs/schema/`)
| مسیر فایل | توضیح و نقش در پروژه |
|---|---|
| `database/migrations/README.md` | راهنمای گام‌به‌گام بکاپ‌گیری و اجرای ایمن مهاجرت‌های MySQL در phpMyAdmin روی cPanel. |
| `database/migrations/mysql/001_fitlytix_product_domains.sql` | مهاجرت افزایشی جداول دامنه‌های محصول در MySQL (`training_programs`, `training_sessions`, `workout_items`, `workout_logs`, `workout_feedback`, `nutrition_plans`, `nutrition_logs`, `ai_coaching_runs`, `subscription_plans`, `subscriptions`, `payment_transactions`, `payment_webhook_events`, `wearable_connections`, `wearable_sync_logs`, `audit_logs`). |
| `database/migrations/mysql/002_fitlytix_core_auth_assessments.sql` | **(جدید)** مهاجرت افزایشی جداول هسته احراز هویت و ارزیابی در MySQL (`users`, `user_sessions`, `sports`, `athlete_profiles`, `assessments`, `assessment_answers`, `body_analysis_records`, `health_metrics`) + داده‌های پایه ۵ رشته ورزشی. |
| `docs/schema/future-schema.sql` | فایل مرجع معماری اولیه (PostgreSQL/Supabase) که فقط جنبه مستندات دارد. |

### ۳. لایه سرور و دیتابیس (`src/lib/*.server.ts` و `src/server/`)
| مسیر فایل | توضیح و نقش در پروژه |
|---|---|
| `src/lib/db.server.ts` | **(جدید)** مدیریت Connection Pool دیتابیس MySQL با `mysql2/promise`، اجرای کوئری‌های پارامتری، تراکنش‌ها، تست اتصال و تشخیص پویا از روی `INFORMATION_SCHEMA`. |
| `src/lib/auth.server.ts` | **(جدید)** منطق احراز هویت سمت سرور، هش رمز عبور (`scrypt`)، ساخت/بررسی/ابطال نشست در MySQL و مدیریت کوکی `fitlytix_session`. |
| `src/server/athlete.repository.ts` | **(جدید)** ریپازیتوری سمت سرور برای ثبت‌نام/ورود ورزشکار، نگاشت اسلاگ رشته به `sports.id`، ذخیره و بازیابی ارزیابی عمومی و تخصصی، ذخیره آنالیز بدن و ترجیحات ساعت هوشمند در MySQL. |
| `src/server.ts` | نقطه ورود سرور SSR در TanStack Start به همراه مدیریت خطاهای سطح سرور. |
| `src/start.ts` | تنظیمات Middlewareهای TanStack Start (شامل CSRF محافظتی و مدیریت خطا). |

### ۴. مسیرهای API سمت سرور (`src/routes/api/`)
| مسیر فایل | آدرس Endpoint | متد | توضیح |
|---|---|---|---|
| `src/routes/api/health.ts` | `/api/health` | `GET` | بررسی سلامت اجرای سرور Node.js (`{"ok":true,"service":"fitlytix"}`). |
| `src/routes/api/db-test.ts` | `/api/db-test` | `GET` | **(جدید)** بررسی اتصال به دیتابیس `eugtezmj_fitlytix` و بازگرداندن نام دیتابیس و تعداد جداول. |
| `src/routes/api/auth.register.ts` | `/api/auth/register` | `POST` | **(جدید)** ثبت‌نام کاربر و ساخت پروفایل ورزشکار در MySQL + تنظیم کوکی `fitlytix_session`. |
| `src/routes/api/auth.login.ts` | `/api/auth/login` | `POST` | **(جدید)** ورود کاربر با ایمیل و رمز عبور + تنظیم کوکی `fitlytix_session`. |
| `src/routes/api/auth.logout.ts` | `/api/auth/logout` | `POST` | **(جدید)** ابطال نشست در دیتابیس و پاک کردن کوکی `fitlytix_session`. |
| `src/routes/api/auth.me.ts` | `/api/auth/me` | `GET` | **(جدید)** بررسی نشست فعلی کاربر از روی کوکی `fitlytix_session` و بازگرداندن اطلاعات کاربر و `athleteId`. |
| `src/routes/api/assessment.ts` | `/api/assessment` | `GET`, `POST` | **(جدید)** دریافت و ذخیره امن ارزیابی عمومی، ارزیابی تخصصی رشته، آنالیز بدن و ساعت هوشمند برای ورزشکار احراز هویت‌شده. |

### ۵. صفحات و مسیرهای کاربری (`src/routes/`)
| مسیر فایل | آدرس URL | توضیح و نقش صفحه |
|---|---|---|
| `src/routes/__root.tsx` | — | قالب ریشه HTML، فونت‌ها، استایل‌های RTL فارسی و مدیریت متاتگ‌ها. |
| `src/routes/index.tsx` | `/` | صفحه اول (Landing Page) معرفی پلتفرم هوشمند مربی‌گری FitLytix. |
| `src/routes/onboarding.tsx` | `/onboarding` | صفحه شروع مسیر ۵ مرحله‌ای ورزشکار (ارزیابی عمومی ← ارزیابی رشته ← Fitness DNA ← پیشنهاد پلن ← عضویت). |
| `src/routes/register.tsx` | `/register` | **(به‌روزرسانی‌شده)** صفحه ساخت حساب متصل به `/api/auth/register` و دیتابیس MySQL با فعال‌سازی فوری نشست. |
| `src/routes/login.tsx` | `/login` | **(به‌روزرسانی‌شده)** صفحه ورود متصل به `/api/auth/login` و کوکی نشست `fitlytix_session`. |
| `src/routes/assessment.common.tsx` | `/assessment/common` | **(بازیابی و متصل‌شده به MySQL)** ارزیابی عمومی شامل ۵ بخش پرسشنامه پایه + گام ۲ (`BodyAnalysisIntake`) + گام ۳ (`WearableIntake`) و ذخیره واقعی در دیتابیس. |
| `src/routes/assessment.sport.tsx` | `/assessment/sport` | **(متصل‌شده به MySQL)** انتخاب رشته ورزشی (CrossFit, HYROX, Functional, Bodybuilding, Running)، انتخاب سطح تجربه و ثبت ارزیابی تخصصی در دیتابیس. |
| `src/routes/plans.tsx` | `/plans` | انتخاب مسیر مربی‌گری (`AI Coach`, `Hybrid`, `Human Coach Pro`) و مشاهده پلن پیشنهادی. |
| `src/routes/checkout.tsx` | `/checkout` | صفحه تکمیل عضویت و اشتراک. |
| `src/routes/athlete.dashboard.tsx` | `/athlete/dashboard` | **(به‌روزرسانی‌شده)** داشبورد اصلی ورزشکار (تمرکز امروز، جلسه بعدی، برنامه فعلی، ریکاوری، رادار Fitness DNA، تغذیه امروز، داده‌های سلامت/پوشیدنی و روند تغییرات بدن). |
| `src/routes/athlete.fitness-dna.tsx` | `/athlete/fitness-dna` | نمایش کامل پروفایل عملکرد چندبعدی (Fitness DNA) به تفکیک رشته ورزشی. |
| `src/routes/athlete.program.tsx` | `/athlete/program` | صفحه اجرای برنامه تمرینی روزانه با بلوک‌های Warm-up, Strength/Weightlifting, Engine, WOD, Skill, Cooldown و راهنمای آموزشی حرکات. |
| `src/routes/athlete.performance.tsx` | `/athlete/performance` | تاریخچه عملکرد، رکوردهای شخصی (`PRs`)، بنچمارک‌ها و نمودار پیشرفت. |
| `src/routes/athlete.recovery.tsx` | `/athlete/recovery` | جزئیات آمادگی روزانه، خواب، HRV، فشار تمرینی و توصیه‌های ریکاوری. |
| `src/routes/athlete.nutrition.tsx` | `/athlete/nutrition` | برنامه تغذیه روزانه بر اساس نوع روز تمرینی (سنگین، تمرین، ریکاوری) و ثبت پایبندی. |
| `src/routes/athlete.health.tsx` | `/athlete/health` | مدیریت اتصال ساعت‌های هوشمند و ثبت دستی شاخص‌های سلامت (HRV، ضربان استراحت، خواب، VO2max). |
| `src/routes/athlete.goals.tsx` | `/athlete/goals` | مدیریت هدف اصلی، اهداف فرعی، نقاط عطف (`Milestones`) و تمرکز هفتگی. |
| `src/routes/athlete.passport.tsx` | `/athlete/passport` | شناسنامه جامع ورزشکار (`Athlete Passport / 360`) قابل اشتراک‌گذاری با مربی. |
| `src/routes/coach.index.tsx` | `/coach` | مرکز فرمان مربی (`Coach Command Center`) با خلاصه وضعیت تیم، هشدارهای ریکاوری و اولویت‌های روز. |
| `src/routes/coach.athletes.tsx` | `/coach/athletes` | فهرست ورزشکاران تحت پوشش مربی با فیلتر بر اساس رشته، هدف و وضعیت آمادگی. |
| `src/routes/coach.athlete.$id.tsx` | `/coach/athlete/:id` | پرونده ۳۶۰ درجه ورزشکار برای مربی (نمای کلی، ارزیابی‌ها، تغییرات بدن، برنامه، تغذیه و تاریخچه). |
| `src/routes/coach.assistant.tsx` | `/coach/assistant` | دستیار هوشمند مربی برای تولید پیش‌نویس برنامه تمرینی و تغذیه با قابلیت ویرایش و تأیید مربی. |
| `src/routes/coach.attention.tsx` | `/coach/attention` | فهرست ورزشکاران نیازمند توجه فوری (افت ریکاوری، غیبت یا گزارش درد). |
| `src/routes/coach.programs.tsx` | `/coach/programs` | مدیریت برنامه‌های تمرینی توسط مربی. |
| `src/routes/coach.nutrition.tsx` | `/coach/nutrition` | مدیریت ساختار تغذیه و پیگیری پایبندی تغذیه‌ای ورزشکاران. |
| `src/routes/coach.performance.tsx` | `/coach/performance` | تحلیل عملکرد گروهی و فردی ورزشکاران برای مربی. |
| `src/routes/coach.exercises.tsx` | `/coach/exercises` | بانک حرکات ورزشی، گزینه‌های اسکیلینگ (`Scaling`) و نکات آموزشی مربی‌گری. |
| `src/routes/coach.profile.tsx` | `/coach/profile` | پروفایل تخصصی مربی و تنظیمات. |

### ۶. مدل‌های دامنه و قالب‌های ارزیابی (`src/domain/`)
| مسیر فایل | توضیح و نقش در پروژه |
|---|---|
| `src/domain/types.ts` | تعریف تمام تایپ‌ها و اینترفیس‌های اصلی (`AthleteProfile`, `Assessment`, `FitnessDNA`, `Program`, `Workout`, `RecoverySnapshot`, `Plan`, `Subscription` و غیره). |
| `src/domain/platform.ts` | تایپ‌های تکمیلی پلتفرم شامل سلامت و پوشیدنی‌ها (`HealthProvider`, `HealthMetric`, `WearableIntent`)، تغذیه، اهداف و پیشنهادهای هوش مصنوعی. |
| `src/domain/sports.ts` | رجیستری ۵ رشته ورزشی (`crossfit`, `hyrox`, `functional`, `bodybuilding`, `running`)، رنگ‌های اختصاصی هر رشته و متادیتای بلوک‌های تمرینی (`BLOCK_META`). |
| `src/domain/body-analysis.ts` | اسکیمای اعتبارسنجی Zod و فیلدهای استاندارد آنالیز ترکیب بدنی (`InBody` و دستی). |
| `src/domain/exercise-education.ts` | ساختار آموزشی حرکات (گام‌های اجرا، نکات مربی، اشتباهات رایج، تنفس و نسخه‌های ساده‌تر/سخت‌تر). |
| `src/domain/workout-display.ts` | فرمت‌بندی نمایش بلوک‌های تمرینی و نسخه‌های Rx / Scaled. |
| `src/domain/assessment/helpers.ts` | توابع کمکی ساخت فیلدها و گزینه‌های قالب ارزیابی (`field`, `options`, `unknownOption`). |
| `src/domain/assessment/common.ts` | قالب کامل ارزیابی عمومی (`common-foundation` نسخه ۲) شامل ۵ بخش (`common.about`, `common.direction`, `common.life`, `common.recovery`, `common.coach_note`). |
| `src/domain/assessment/crossfit.ts` | قالب ارزیابی تخصصی کراس‌فیت (`crossfit-foundation`) شامل ۷ بخش (سطح و اسکیلینگ، قدرت پایه، Engine، بنچمارک‌های WOD، مهارت‌های ژیمناستیک، وزنه‌برداری و ریکاوری). |
| `src/domain/assessment/hyrox.ts` | قالب ارزیابی تخصصی HYROX (`hyrox-foundation`) شامل ۴ بخش (دویدن، تجربه مسابقه، ایستگاه‌های هشت‌گانه و قدرت-استقامت). |
| `src/domain/assessment/functional.ts` | قالب ارزیابی تخصصی تمرین فانکشنال (`functional-foundation`) شامل ۴ بخش (کیفیت حرکت، موبیلیتی و تعادل، قدرت کاربردی و آمادگی). |
| `src/domain/assessment/bodybuilding.ts` | قالب ارزیابی تخصصی بدنسازی (`bodybuilding-foundation`) شامل ۵ بخش (هدف و سابقه، تقسیم تمرین Split، حجم و کنترل، لیفت‌های اصلی و کاردیو/تغذیه). |
| `src/domain/assessment/running.ts` | قالب ارزیابی تخصصی دویدن (`running-foundation`) شامل ۴ بخش (پایه دویدن، پیس و رکوردهای 5K/10K/Half، نوع تمرین و هدف مسابقه/سلامت). |
| `src/domain/assessment/registry.ts` | تجمیع و اکسپورت `COMMON_ASSESSMENT` و `SPORT_ASSESSMENTS`. |
| `src/domain/assessment/templates.ts` | اکسپورت مجدد قالب‌ها برای حفظ سازگاری مسیرهای ایمپورت. |

### ۷. سرویس‌های دامنه (`src/services/`)
| مسیر فایل | توضیح و نقش در پروژه |
|---|---|
| `src/services/assessment/engine.ts` | **(به‌روزرسانی‌شده)** موتور ارزیابی؛ محاسبه درصد تکمیل، فیلتر سوالات بر اساس سطح تجربه و ارسال/دریافت ارزیابی‌ها از `/api/assessment`. |
| `src/services/body-analysis/service.ts` | سرویس اعتبارسنجی، ذخیره و محاسبه روند تغییرات وزن، درصد چربی و توده عضلانی. |
| `src/services/health-data/service.ts` | سرویس مدیریت اتصال گجت‌های پوشیدنی، ثبت دستی شاخص‌های سلامت و نرمال‌سازی داده‌ها. |
| `src/services/health-data/providers.ts` | تعریف قابلیت‌های هر سرویس پوشیدنی (Garmin, Apple Health, Health Connect و غیره). |
| `src/services/health-data/normalize.ts` | نرمال‌سازی و اعتبارسنجی محدوده فیزیولوژیک داده‌های سلامت. |
| `src/services/athlete/dashboard.ts` | تولید تصویر خلاصه داشبورد ورزشکار بر اساس رشته ورزشی. |
| `src/services/athlete/athlete360.ts` | تجمیع پرونده ۳۶۰ درجه ورزشکار. |
| `src/services/fitness-dna/inputs.ts` | نگاشت ورودی‌های ارزیابی، ترکیب بدنی و سلامت به ابعاد Fitness DNA. |
| `src/services/decision-engine/service.ts` | موتور تصمیم‌یار مربی‌گری برای تولید توصیه‌های روزانه با ذکر دلیل (`why`) و منابع داده (`inputs`). |
| `src/services/ai-coaching/engine.ts` | سرویس پایه تحلیل هوشمند و پیشنهاد برنامه. |
| `src/services/ai-coaching/proposals.ts` | تولید پیش‌نویس برنامه‌های تمرینی و تغذیه برای بررسی و تأیید مربی (`needs_review` ← `approved`). |
| `src/services/program/service.ts` | سرویس مدیریت برنامه تمرینی و جلسات هفتگی. |
| `src/services/nutrition/service.ts` | سرویس برنامه تغذیه روزانه و ثبت بازخورد تغذیه. |
| `src/services/recovery/service.ts` | محاسبه امتیاز آمادگی (`Readiness`) و تحلیل عوامل خواب و فشار تمرینی. |
| `src/services/performance/engine.ts` | تحلیل شاخص عملکرد، رکوردها و بنچمارک‌ها. |
| `src/services/goals/service.ts` | مدیریت اهداف ورزشکار و مراحل مسیر پیشرفت. |
| `src/services/coach/service.ts` | سرویس مدیریت لیست ورزشکاران مربی، فیلترها و گزارش هفتگی. |
| `src/services/subscriptions/service.ts` | مدیریت بسته‌های اشتراک (تمرین، تغذیه، ترکیبی). |
| `src/services/commerce/service.ts` | سرویس شبیه‌سازی فرآیند تسویه و اشتراک. |
| `src/services/notifications/service.ts` | سرویس یادآورها و اعلان‌های ورزشکار و مربی. |

### ۸. کامپوننت‌های رابط کاربری (`src/components/`)
| مسیر فایل | توضیح و نقش در پروژه |
|---|---|
| `src/components/domain/assessment.tsx` | کامپوننت‌های `StepIndicator`، `AssessmentSectionCard`، کنترل‌های ورودی سوالات و ثابت `ASSESSMENT_STEPS`. |
| `src/components/domain/body-analysis.tsx` | کامپوننت `BodyAnalysisIntake` (گام ۲ ارزیابی عمومی) و پنل نمودار روند تغییرات بدن (`BodyChangesPanel`). |
| `src/components/domain/body-analysis-dialog.tsx` | دیالوگ ثبت اندازه‌گیری جدید ترکیب بدنی در داشبورد. |
| `src/components/domain/health-data.tsx` | کامپوننت `WearableIntake` (گام ۳ ارزیابی عمومی)، لیست اتصال پوشیدنی‌ها (`WearableConnections`) و پنل داده‌های سلامت (`HealthDataPanel`). |
| `src/components/domain/sport.tsx` | کارت انتخاب رشته ورزشی (`SportCard`). |
| `src/components/domain/workout.tsx` | کارت‌ها و بلوک‌های نمایش جلسه تمرینی و ثبت نتیجه. |
| `src/components/domain/exercise-guide.tsx` | دراور/مودال آموزش اجرای صحیح حرکات تمرینی. |
| `src/components/domain/coaching.tsx` | کارت‌های توصیه روزانه مربی، نوار مسیر هدف و کارت آمادگی. |
| `src/components/domain/charts.tsx` | نمودار رادار `DnaRadarChart` و نمودار میله‌ای ریکاوری (`RecoveryBars`). |
| `src/components/domain/primitives.tsx` | اجزای پایه طراحی FitLytix (`Panel`, `Pill`, `ProgressRing`, `Bar`, `Stat`, `SectionHeading`, `PageHeader`, `MockBadge`). |
| `src/components/layout/AppShell.tsx` | پوسته اصلی داشبورد ورزشکار و مرکز فرمان مربی (منوی کناری RTL، هدر و ناوبری موبایل). |
| `src/components/layout/MarketingShell.tsx` | پوسته صفحات عمومی، احراز هویت و جریان ارزیابی. |

---

## بخش چهارم: دستورات دقیق همگام‌سازی گیت‌هاب و استقرار روی سرور cPanel

از آنجا که محیط اجرای فعلی دسترسی مستقیم SSH به سرور `/home/eugtezmj/public_html/fitlytix-app` و توکن نوشتن مستقیم روی گیت‌هاب شما را ندارد، تمام تغییرات در مخزن محلی محیط کار (`/home/user/fitlytix-foundation`) کامیت و بیلد شده‌اند (تست تایپ‌اسکریپت `npx tsc --noEmit` و بیلد پروداکشن `npm run build` و تست سلامت `scripts/verify-prod.mjs` همگی با موفقیت ۱۰۰٪ اجرا شدند).

### گام ۱: بررسی و بکاپ فایل‌های فعلی روی سرور cPanel (قبل از هر کاری)
در ترمینال cPanel اجرا کنید:
```bash
cd /home/eugtezmj/public_html/fitlytix-app
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)
```

### گام ۲: اجرای مهاجرت افزایشی دیتابیس (در صورت نیاز)
در phpMyAdmin روی دیتابیس `eugtezmj_fitlytix`:
1. ابتدا یک Export کامل (`Quick -> SQL`) برای بکاپ بگیرید.
2. فایل `database/migrations/mysql/002_fitlytix_core_auth_assessments.sql` را Import کنید (این فایل فقط جدول‌های احتمالی ناموجود را با `CREATE TABLE IF NOT EXISTS` می‌سازد و ۵ رشته اصلی را در جدول `sports` تضمین می‌کند و هیچ داده موجودی را حذف نمی‌کند).

### گام ۳: تنظیم متغیرهای محیطی در cPanel (`Setup Node.js App`)
اطمینان حاصل کنید متغیرهای محیطی زیر در بخش **Setup Node.js App** برای اپلیکیشن `fitlytix-app` تعریف شده‌اند:
- `NODE_ENV=production`
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=eugtezmj_fitlytix`
- `DB_USER=<نام کاربری دیتابیس MySQL>`
- `DB_PASSWORD=<رمز عبور دیتابیس MySQL>`
- `SESSION_SECRET=<یک رشته تصادفی حداقل ۳۲ کاراکتری>`

### گام ۴: بیلد و ری‌استارت اپلیکیشن روی سرور cPanel
```bash
source ~/nodevenv/public_html/fitlytix-app/22/bin/activate
cd /home/eugtezmj/public_html/fitlytix-app
npm install
npm run build
mkdir -p tmp && touch tmp/restart.txt
```
سپس با دستور زیر سلامت سرور و دیتابیس را بررسی کنید:
```bash
curl -s https://app.fitlytix.ir/api/health
curl -s https://app.fitlytix.ir/api/db-test
```
