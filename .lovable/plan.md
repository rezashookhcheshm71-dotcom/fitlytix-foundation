# برنامه اجرایی بازطراحی FitLytix Foundation — نسخه اول واقعی

## هدف و ترتیب اجرا
تجربه را از یک نمونه عمدتاً کراس‌فیت‌محور به محصولی فارسی-first، انسانی و واقعاً رشته‌محور تبدیل می‌کنیم؛ بدون افزودن backend واقعی و با حفظ مرزهای mock/service.

اولویت‌ها:
1. **درستی ارزیابی و ایمنی سؤال‌ها**
2. **مدل داده پایدار و پروفایل رشته‌ای**
3. **داشبورد و Fitness DNA متناسب با رشته**
4. **یکپارچگی Design System و بازنویسی لحن**
5. **QA پنج رشته، دو سطح، موبایل و RTL**

## وضعیت فعلی تأییدشده
- قالب مشترک فقط اطلاعات پایه، هدف و سلامت را دارد و هنوز هدف فرعی، زمان جلسه، سبک زندگی، تجهیزات و توضیح آزاد را پوشش نمی‌دهد (`src/domain/assessment/templates.ts`).
- پنج قالب با scope مستقل تعریف شده‌اند؛ در قالب فعلی Bodybuilding سؤال CrossFit وجود ندارد، اما تنها یک سؤال Bench Press دارد. HYROX دو بخش و Functional و Running هرکدام یک بخش دارند، پس برای تصمیم‌گیری تمرینی کافی نیستند (`src/domain/assessment/templates.ts`).
- عمق تطبیقی فعلی فقط یک Boolean به نام `advancedOnly` است و فقط advanced/elite را از بقیه جدا می‌کند؛ شرط، اختیاری‌بودن، «نمی‌دانم» و توضیح انسانی ندارد (`src/domain/types.ts`, `src/services/assessment/engine.ts`).
- `getSportTemplate` برای ورودی نامعتبر به CrossFit fallback می‌کند؛ این رفتار حذف می‌شود تا هیچ رشته‌ای ناخواسته قالب CrossFit نگیرد (`src/services/assessment/engine.ts`).
- مسیر Common Assessment پس از ثبت، CrossFit را به‌صورت پیش‌فرض انتخاب می‌کند (`src/routes/assessment.common.tsx`).
- داشبورد، برنامه، عملکرد، Fitness DNA و بخش عمده Athlete 360 مستقیماً داده‌های نمونه CrossFit را مصرف می‌کنند؛ Athlete 360 حتی برای ورزشکاران دیگر همان داده کامل CrossFit را نشان می‌دهد (`src/routes/athlete.dashboard.tsx`, `src/routes/athlete.program.tsx`, `src/routes/athlete.performance.tsx`, `src/routes/athlete.fitness-dna.tsx`, `src/routes/coach.athlete.$id.tsx`, `src/mock/athlete.ts`, `src/mock/program.ts`).
- پالت charcoal/ember و tokenهای رشته‌ای وجود دارد، اما glow، نارنجی، radiusهای بزرگ، متن انگلیسی و buttonهای خام در چند بخش بیش از حد یا ناهماهنگ استفاده شده‌اند (`src/styles.css` و کامپوننت‌های domain/layout).

## فاز 1 — قرارداد داده و معماری ارزیابی

### مدل سؤال
در `src/domain/types.ts` قرارداد ارزیابی توسعه می‌یابد:
- ID پایدار و namespaceدار، مثل `common.profile.age` و `bodybuilding.training.split`؛ ID با تغییر متن یا ترتیب عوض نمی‌شود.
- `valueType` و گزینه‌های دارای `value` پایدار + `label` فارسی، به‌جای ذخیره مستقیم متن نمایشی.
- سطح نمایش `all | intermediatePlus | advancedPlus` به‌جای `advancedOnly`.
- `required`، `allowUnknown`، hint، کمک کوتاه، بازه/step و span نمایشی.
- قواعد شرطی ساده برای نمایش سؤال بر اساس سطح یا پاسخ قبلی، بدون قرار دادن منطق در JSX.
- نسخه template و schema پاسخ مستقل از UI؛ پاسخ‌ها به شکل `templateId + templateVersion + sportId + answers` قابل ذخیره باقی می‌مانند.
- `DnaDimensionId` از union ثابت کراس‌فیت‌محور به شناسه قابل توسعه رشته‌ای تبدیل می‌شود و label/insight همچنان همراه داده باقی می‌ماند.

### جداسازی قالب‌ها
فایل بزرگ فعلی به registry و شش فایل مستقل تقسیم می‌شود:
- `src/domain/assessment/common.ts`
- `src/domain/assessment/crossfit.ts`
- `src/domain/assessment/bodybuilding.ts`
- `src/domain/assessment/hyrox.ts`
- `src/domain/assessment/functional.ts`
- `src/domain/assessment/running.ts`
- `src/domain/assessment/registry.ts`

`src/domain/assessment/templates.ts` یا به export سازگارکننده محدود می‌شود یا پس از انتقال importها حذف می‌شود. Registry فقط lookup صریح انجام می‌دهد و هیچ fallback به CrossFit ندارد.

## فاز 2 — بازسازی محتوای ارزیابی

### Common Assessment
بخش‌های کوتاه و قابل فهم:
1. **درباره تو:** سن، قد، وزن، سابقه تمرین.
2. **مسیرت:** «این روزها بیشتر دنبال چی هستی؟»، هدف فرعی، تعداد جلسه، زمان هر جلسه.
3. **روزمره و دسترسی:** شغل/سبک زندگی، فعالیت روزانه، خانه/home gym/باشگاه و تجهیزات کلیدی.
4. **ریکاوری و ایمنی:** خواب، کیفیت ریکاوری، درد/آسیب/محدودیت و چند سؤال کوتاه body condition فقط وقتی برای ایمنی یا حجم تمرین مفید باشد.
5. **نکته برای مربی:** textarea با متن «هر چیزی هست که دوست داری مربی درباره‌ات بدونه؟».

برای پاسخ‌های متناقض مانند «محدودیت ندارم» در کنار ناحیه آسیب‌دیده، انتخاب‌ها mutually exclusive می‌شوند.

### قالب‌های کاملاً مستقل رشته‌ای
- **CrossFit:** تجربه و scaling، benchmarkها، PRها، weightlifting، gymnastics skills، engine و هدف؛ ترتیب بخش‌ها با منطق warm-up → strength/bodybuilding → engine → WOD → skill → weightlifting → cooldown حفظ می‌شود. Benchmark و PR برای مبتدی اجباری نیست و «تا حالا تست نکردم» دارد.
- **Bodybuilding:** هدف hypertrophy/fat loss، سابقه، split، اولویت گروه عضلانی، تجربه حرکات، major lifts، تحمل volume، کنترل/mind-muscle connection، نقاط ضعف، cardio و عادت غذایی. هیچ WOD، Fran/Grace/Cindy، Bar Muscle-up یا CrossFit Engine در این template قرار نمی‌گیرد.
- **HYROX:** pace و distance دویدن، تجربه مسابقه، sled push/pull، SkiErg، Row، farmer carry، sandbag/lunges، wall balls، pacing و strength-endurance.
- **Functional:** کیفیت الگوهای حرکتی، mobility، unilateral strength، core، conditioning، balance/coordination و محیط تمرین؛ به‌جای درخواست امتیاز تخصصی FMS از مبتدی، گزینه‌های قابل مشاهده و ساده ارائه می‌شود.
- **Running:** mileage هفتگی، سابقه، 5K/10K/half marathon اخیر، pace/easy pace، zone familiarity، interval experience، سطح تمرین، آسیب‌های مرتبط و race goal.

هر سؤال با یکی از purposeهای `programming | level | scaling | load | goal | safety | recovery` مستند می‌شود؛ سؤال بدون اثر تصمیم‌گیری حذف خواهد شد.

## فاز 3 — تجربه هدایت‌شده و عمق تطبیقی

فایل‌های اصلی: `src/components/domain/assessment.tsx`, `src/routes/assessment.common.tsx`, `src/routes/assessment.sport.tsx`, `src/services/assessment/engine.ts`.

- فرم از لیست بلند کارت‌ها به مراحل کوتاه با یک سؤال/گروه منطقی در هر viewport تبدیل می‌شود؛ پیشرفت بر اساس سؤال‌های قابل‌مشاهده و ضروری محاسبه می‌شود.
- سطح تجربه ابتدا با توضیح انسانی انتخاب می‌شود؛ beginner سؤال‌های ساده می‌بیند و intermediate/advanced بخش «جزئیات بیشتر، اگر سابقه تمرین داری» را باز می‌کنند.
- label «ADV» حذف و با عنوان انسانی و امکان باز/بسته‌کردن جزئیات جایگزین می‌شود.
- `textarea`، انتخاب تک/چندگزینه‌ای دسترس‌پذیر، حالت «نمی‌دونم / تست نکردم»، validation نرم و پیام خطای فارسی افزوده می‌شود.
- buttonهای خام با کنترل‌های Design System جایگزین می‌شوند؛ focus، keyboard، tap target و selected state یکسان می‌شود.
- انتخاب رشته از Common Assessment دیگر CrossFit را تحمیل نمی‌کند؛ کاربر به انتخاب پنج رشته می‌رسد و تغییر رشته پاسخ‌های رشته قبلی را وارد قالب جدید نمی‌کند.
- متن‌های ماشینی مانند «موتور ارزیابی سؤال‌ها را یادآوری می‌کند» با لحن کوتاه مربی‌محور بازنویسی می‌شوند.

## فاز 4 — Sport Profile و داشبورد تطبیقی

### قرارداد داده
در `src/domain/types.ts` و یک registry جدید مثل `src/domain/dashboard/sport-profiles.ts` تعریف می‌شود:
- `SportPerformanceProfile`: محورهای radar، KPIها، insightها، widgetها، قالب session و واحدها برای هر رشته.
- `DashboardSnapshot`: athlete، sport، todayFocus، activeProgram، recovery، performance، DNA، insights و recentSessions.
- محورهای هر رشته:
  - CrossFit: strength، engine، gymnastics، weightlifting، mobility، recovery.
  - Bodybuilding: hypertrophy progress، strength، volume tolerance، muscle balance، control، recovery.
  - Running: aerobic base، threshold، speed، endurance، durability، recovery.
  - HYROX: running، stations، strength-endurance، pacing، transitions، recovery.
  - Functional: movement quality، mobility، unilateral strength، core، conditioning، balance.

### داده نمایشی و service boundary
- mockها به fixtureهای رشته‌ای زیر `src/mock/athletes/` تفکیک می‌شوند؛ برای هر پنج رشته یک snapshot کوچک اما کامل ساخته می‌شود.
- یک service خواندنی مانند `src/services/athlete/dashboard.ts` بر اساس `primarySport` snapshot مناسب را برمی‌گرداند؛ route دیگر mock CrossFit را مستقیم import نمی‌کند.
- `ai-coaching/engine.ts` و `performance/engine.ts` به داده context ورودی تکیه می‌کنند و متن/adjustment کراس‌فیت را برای همه رشته‌ها تولید نمی‌کنند.
- backend اضافه نمی‌شود؛ interfaceها همان نقطه جایگزینی آینده با API/DB خواهند بود.

### نمایش
فایل‌های اصلی: `src/routes/athlete.dashboard.tsx`, `src/components/domain/charts.tsx`, `src/routes/athlete.fitness-dna.tsx` و در حد سازگاری `athlete.performance.tsx`, `athlete.program.tsx`, `coach.athlete.$id.tsx`.

- Dashboard بر اساس رشته، عنوان کاربر، تمرکز امروز، KPI، روند، تمرین بعدی، مهارت/هدف و جلسه‌های اخیر را عوض می‌کند.
- Radar محور و رنگ accent را از profile رشته می‌گیرد؛ label فارسی خوانا و داده انگلیسی اجباری نیست.
- کنار Radar سه تا پنج insight ثابت‌ساختار نمایش داده می‌شود: «نقطه قوت»، «فعلاً عقب‌تره»، «تمرکز این هفته» و در صورت نیاز «ریسک/ریکاوری».
- Athlete 360 دیگر داده CrossFit را برای ورزشکار Bodybuilding/Running/HYROX/Functional نمایش نمی‌دهد؛ تب‌های فاقد داده، empty state صادقانه و رشته‌محور دارند.
- برنامه و Performance حداقل پوسته، metadata و metrics صحیح رشته را می‌گیرند؛ جزئیات کامل برنامه پنج رشته خارج از این فاز نیست، اما هیچ widget نامرتبط نمایش داده نمی‌شود.

## فاز 5 — Design System و بازنویسی لحن

### فایل‌های Design System
`src/styles.css`, `src/components/ui/button.tsx`, `src/components/domain/primitives.tsx`, `src/components/domain/sport.tsx`, `src/components/domain/workout.tsx`, `src/components/layout/AppShell.tsx`.

- charcoal/near-black حفظ می‌شود؛ contrast سطوح، border و muted text تنظیم و glow به CTA/active/data highlight محدود می‌شود.
- orange فقط در CTA، active state و highlight اصلی؛ accent رشته عمدتاً خط باریک، icon، نقطه chart یا selected state است.
- radius کارت‌ها به طیف کنترل‌شده حداکثر 8px نزدیک می‌شود؛ کارت تو در تو و لکه‌های blur تزئینی کاهش می‌یابد.
- hierarchy تایپوگرافی فارسی، line-height و وزن‌ها یکدست می‌شود؛ `.num` فقط برای عدد/رکورد و با tabular numerals باقی می‌ماند، نه کل متن انگلیسی.
- Button، badge/pill، card/panel، stat، progress، chart tooltip، focus ring و mobile bottom nav stateهای مشترک می‌گیرند.
- motion فقط برای ورود کوتاه، تغییر progress و feedback تعامل است و `prefers-reduced-motion` حفظ می‌شود.

### بازنویسی محتوا
یک content pass روی صفحات عمومی و محصول انجام می‌شود: `index`, `onboarding`, `assessment.*`, `plans`, `register`, `login`, `athlete.*`, `coach.athlete.$id` و متن‌های mock/service.
- فارسی کوتاه، طبیعی و مربی‌محور؛ نه بچگانه و نه تبلیغاتی.
- عبارت‌های AI-marketing و labelهای داخلی مانند `COMMON ASSESSMENT`, `Today's Focus`, `Next Workout`, `Active Program`, `Dimension breakdown` تا جای ممکن فارسی می‌شوند.
- اصطلاحات استاندارد WOD، PR، RPE، HRV و نام حرکات حفظ می‌شوند.
- صفحه‌های 404 و خطای عمومی در `src/routes/__root.tsx` نیز فارسی می‌شوند تا متن placeholder انگلیسی باقی نماند.
- badgeهای «نمایشی» برای OTP، پرداخت، خروجی برنامه و ذخیره‌سازی حفظ می‌شوند، اما لحنشان ساده و شفاف می‌شود.

## فاز 6 — QA و معیار پذیرش

### تست‌های منطقی
برای `assessmentEngine` و registry تست اضافه می‌شود:
- هر پنج SportId دقیقاً template خودش را برمی‌گرداند و sport نامعتبر خطای کنترل‌شده می‌دهد، نه CrossFit.
- ID همه سؤال‌ها در کل registry یکتا و پایدار است؛ option valueها تکراری نیستند.
- Bodybuilding هیچ ID/section/option مربوط به `wod`, `fran`, `grace`, `cindy`, `murph`, `muscle-up`, `gymnastics` یا engine کراس‌فیت ندارد.
- beginner در هر پنج رشته فقط سؤال‌های ساده/ضروری را می‌بیند؛ advanced جزئیات تخصصی همان رشته را می‌بیند.
- completion فقط سؤال‌های visible و required را محاسبه می‌کند و unknown پاسخ معتبر محسوب می‌شود.
- هر سؤال purpose معتبر دارد.

### تست مرورگر
در desktop و mobile RTL، برای هر پنج رشته:
1. Common Assessment → انتخاب رشته → انتخاب سطح beginner → مرور همه بخش‌ها.
2. تکرار با advanced و تأیید بازشدن جزئیات همان رشته.
3. تغییر رشته وسط flow و اطمینان از عدم انتقال پاسخ/متن نامرتبط.
4. ورود به Dashboard نمایشی هر رشته و تأیید KPI، Radar، insight و sessionهای مربوط.
5. بررسی bottom navigation، overflow، focus، tap target، chart label و نبود هم‌پوشانی.

در پایان build diagnostics، console/runtime errors و متن‌های باقی‌مانده انگلیسی/AI-marketing بررسی می‌شوند.

## فایل‌های اصلی که تغییر می‌کنند و دلیل
- `src/domain/types.ts` — قرارداد نسخه‌دار سؤال، پاسخ و dashboard profile.
- `src/domain/assessment/*` — قالب مستقل و قابل تست برای Common و پنج رشته.
- `src/services/assessment/engine.ts` — resolver امن، شرط‌های عمق و completion صحیح.
- `src/components/domain/assessment.tsx` — کنترل‌های انسانی، textarea، unknown و بخش جزئیات.
- `src/routes/assessment.common.tsx`, `src/routes/assessment.sport.tsx` — flow هدایت‌شده و حذف انتخاب پیش‌فرض CrossFit.
- `src/domain/sports.ts` — metadata منبع واحد برای رشته و accent؛ نه منبع سؤال‌ها.
- `src/domain/dashboard/sport-profiles.ts` — تعریف KPI/radar/widget هر رشته.
- `src/mock/athletes/*`, `src/mock/program.ts` — fixture رشته‌ای پشت service boundary.
- `src/services/athlete/dashboard.ts`, `src/services/performance/engine.ts`, `src/services/ai-coaching/engine.ts` — مشتق‌سازی بر اساس profile و حذف فرض CrossFit.
- `src/routes/athlete.dashboard.tsx`, `athlete.fitness-dna.tsx`, `athlete.performance.tsx`, `athlete.program.tsx`, `coach.athlete.$id.tsx` — نمایش sport-aware و حذف fallback داده CrossFit.
- `src/components/domain/charts.tsx`, `primitives.tsx`, `sport.tsx`, `workout.tsx`, `src/components/ui/button.tsx`, `src/components/layout/AppShell.tsx`, `src/styles.css` — Design System واحد و RTL/mobile.
- routeها و mockهای دارای copy — بازنویسی فارسی و حذف متن‌های داخلی/placeholder نامناسب.
- تست‌های جدید برای assessment registry/engine و dashboard profile — جلوگیری از regression بین رشته‌ها.

## خارج از محدوده این اجرا
- اتصال دیتابیس، ثبت واقعی پاسخ‌ها، احراز هویت، OTP، پرداخت یا AI واقعی.
- چندرشته‌ای‌کردن هم‌زمان یک ورزشکار؛ مدل این نسخه یک `primarySport` دارد. ساختار ID و registry طوری می‌ماند که این قابلیت بعداً بدون بازنویسی فرم‌ها اضافه شود.
