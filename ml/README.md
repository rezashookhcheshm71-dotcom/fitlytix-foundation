# FitLytix — موتور پیشنهاد برنامه (آموزش مدل)

این پوشه، بخش **آموزش** مدل پیشنهاد برنامه است. مدل نهایی به‌صورت JSON داخل
`src/services/recommendation/model/` ذخیره می‌شود و **در همان سرور Node خودتان اجرا می‌شود** —
یعنی روی cPanel/Passenger به پایتون یا سرویس inference جداگانه نیاز ندارید.

```
ml/
├── train.py              # خط فرمان آموزش + ارزیابی + خروجی JSON
├── requirements.txt      # فقط وابستگی آموزش (numpy/pandas/scikit-learn)
└── fitlytix_ml/
    ├── schema.py         # منبع واحد حقیقت: ویژگی‌ها، archetypeها، برچسب‌ها
    ├── simulator.py      # شبیه‌سازی کوهورت ورزشکاران و تابع سود مربیگری
    └── export.py         # تبدیل درخت‌های sklearn به JSON قابل اجرا در Node
```

## ۱) نصب و آموزش

```bash
python3 -m venv .venv
. .venv/bin/activate            # ویندوز: .venv\Scripts\activate
pip install -r ml/requirements.txt

python ml/train.py --rows 48000 --seed 42
```

خروجی‌ها:

| فایل                                                  | نقش                                                      |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `src/services/recommendation/model/model.json`        | مدل قابل اجرا در Node (درخت‌ها + ویژگی‌ها + archetypeها) |
| `src/services/recommendation/model/metrics.json`      | گزارش ارزیابی روی داده تست                               |
| `src/services/recommendation/model/parity_cases.json` | ۲۰۰ ورزشکار تست + احتمال‌های sklearn برای صحت‌سنجی       |

سپس صحت مفسر TypeScript را چک کنید:

```bash
node --experimental-strip-types scripts/check-model-parity.mjs
```

باید خطای مطلق حداکثر حدود `1e-6` باشد. اگر نبود، مدل و runtime از هم جدا شده‌اند و
نباید deploy شود.

## ۲) این مدل چه چیزی یاد می‌گیرد؟

چهار خروجی مستقل:

| خروجی       | نوع                                      | مثال                |
| ----------- | ---------------------------------------- | ------------------- |
| `program`   | طبقه‌بندی چندکلاسه، **جدا برای هر رشته** | `cf_strength_skill` |
| `nutrition` | طبقه‌بندی ۵ کلاسه                        | `performance_fuel`  |
| `duration`  | طبقه‌بندی ۴ کلاسه                        | `3` ماه             |
| `coaching`  | طبقه‌بندی ۳ کلاسه                        | `hybrid`            |

به‌علاوه دو رگرسور: تعداد جلسات هفتگی و **پیش‌بینی پایبندی** تا پایان دوره.

## ۳) برچسب‌ها از کجا می‌آیند؟ (مهم)

در روز اول، داده واقعی وجود ندارد. بنابراین `simulator.py` یک کوهورت مصنوعی می‌سازد:

1. برای هر ورزشکار، ویژگی‌های قابل‌مشاهده (ارزیابی، ترکیب بدن، رفتار ۲۸ روز) و
   «ظرفیت‌های پنهان» (قدرت، موتور، مهارت، ظرفیت ریکاوری، نظم) تولید می‌شود.
2. برای هر ۴ برنامهٔ همان رشته، نتیجه شبیه‌سازی می‌شود: هم‌راستایی با هدف،
   تناسب ظرفیت با تقاضا، پایبندی، ریسک آسیب و اثر مرحلهٔ رشد.
3. برنامه‌ای که بیشترین سود را دارد برچسب می‌خورد؛ طول دوره هم با مدل ارزش
   تنزیلی (خطر رها کردن، اصطکاک تعهد، افق هدف) انتخاب می‌شود.
4. مدل GBDT فقط از ویژگی‌های **قابل‌مشاهده** آموزش می‌بیند، نه از ظرفیت‌های پنهان.

پس مدل، فشرده‌سازی یک سیاست مربیگری مستند است — نه کشف علمی درباره اثربخشی واقعی.
اعداد `metrics.json` نشان می‌دهد pipeline سالم است؛ **شاهد بهبود واقعی ورزشکار نیست**.

## ۴) استفاده از داده واقعی (وقتی ترافیک داشتید)

هر درخواست API در جدول `recommendation_events` و نتیجهٔ هر دوره در
`recommendation_outcomes` ذخیره می‌شود (migration `003`). برای آموزش روی داده واقعی:

```python
# پیش‌نویس: جایگزینی simulate_cohort با خواندن از MySQL
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine("mysql+pymysql://user:pass@host/db")
events = pd.read_sql("SELECT * FROM recommendation_events WHERE created_at < NOW() - INTERVAL 90 DAY", engine)
outcomes = pd.read_sql("SELECT * FROM recommendation_outcomes", engine)

# context  = events.input_json  → با همان features.extractFeatures بازسازی شود
# action   = events.program_archetype / duration_months / nutrition_strategy
# reward   = outcomes.completed_cycle, adherence, progress_score
```

نکات عملی:

- **حداقل داده:** برای هر رشته و هر archetype حداقل ~۲۰۰ نمونهٔ کامل‌شده. کمتر از آن،
  مدل را با simulator ترکیب کنید (pretrain + fine-tune) یا فعلاً همان سیاست قواعدی را نگه دارید.
- **جایزه (reward) را چندعاملی بگیرید:** پایبندی + پیشرفت + نبود آسیب، نه فقط تمدید اشتراک.
  بهینه‌سازی صرف روی تمدید، به پیشنهاد برنامه‌های «راحت» منحرف می‌شود.
- **سوگیری انتخاب:** فقط برنامه‌هایی را می‌بینید که قبلاً پیشنهاد داده‌اید. برای داده‌های
  خارج از سیاست (off-policy)، وزن نمونه‌ها را با propensity برعکس کنید یا حداقل ۵–۱۰٪
  ترافیک را به انتخاب تصادفی/کاوشی بدهید.
- **اعتبارسنجی زمانی:** split تصادفی کافی نیست؛ آموزش روی داده قدیمی‌تر و تست روی
  داده جدیدتر (مثلاً ۳ ماه آخر) انجام شود.
- بعد از هر آموزش، `metrics.json` و `check-model-parity.mjs` را با هم مرور کنید و نسخه را
  در `model_registry` ثبت کنید.

## ۵) پارامترها

```bash
python ml/train.py --rows 120000 --seed 7 --test-size 0.2
```

- `--rows`: اندازه کوهورت. بیشتر = پایدارتر، کندتر (۴۸ هزار ≈ چند دقیقه).
- `--seed`: تکرارپذیری. مدل و fixtureها هر دو با همین seed ساخته می‌شوند.
- `--out`: مسیر خروجی (پیش‌فرض همان پوشه مدل در `src/`).

## ۶) قانون‌های تغییر schema

اگر ویژگی، رشته یا archetype اضافه/حذف کردید:

1. `schema.py` را تغییر دهید (نه فایل تولیدشده را دستی).
2. `ml/train.py` را دوباره اجرا کنید.
3. اگر archetype جدید است، قالب هفتگی‌اش را در
   `src/services/recommendation/archetypes.ts` اضافه کنید؛ در غیر این صورت
   `schemaGuard` در لاگ هشدار می‌دهد و برنامه به قالب پیش‌فرض برمی‌گردد.
4. `scripts/check-model-parity.mjs` و `npx tsc --noEmit` را اجرا کنید.

## ۷) هشدارها

- این مدل **تشخیص پزشکی نمی‌دهد** و جای متخصص تغذیه/فیزیوتراپی را نمی‌گیرد.
- خروجی تغذیه فقط «ساختار و بازه» است، نه کالری‌شماری یا رژیم درمانی.
- در شرایط درد محدودکننده، بارداری، بیماری مزمن یا ورزشکار زیر ۱۶ سال، مسیر
  بازبینی انسانی (`safety.level = review_required`) باید فعال بماند.
