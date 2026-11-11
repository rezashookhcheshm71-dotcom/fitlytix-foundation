# نقشه کد موتور پیشنهاد برنامه (FitLytix)

اگر نمی‌دانید کد کجاست، از همین سند شروع کنید. همه‌چیز در دو پوشه و سه فایل است.

## ۱) کد در ریپو کجاست؟

```
fitlytix-foundation/
├── ml/                                    ← آموزش مدل (پایتون، فقط offline)
│   ├── train.py                           ← نقطه شروع آموزش (CLI)
│   ├── requirements.txt
│   ├── README.md                          ← راهنمای آموزش/آموزش مجدد
│   └── fitlytix_ml/
│       ├── schema.py                      ← منبع واحد: ۵۶ ویژگی + ۲۰ archetype
│       ├── simulator.py                   ← کوهورت مصنوعی + تابع سود مربی
│       └── export.py                      ← sklearn → JSON
│
├── src/domain/recommendation.ts           ← تایپ‌های قرارداد (Request/Response)
│
├── src/services/recommendation/           ← runtime مدل (TypeScript، همان سرور Node)
│   ├── model/model.json                   ← خود مدل (۱.۳MB، تولیدشده)
│   ├── model/metrics.json                 ← گزارش ارزیابی
│   ├── model/parity_cases.json            ← fixture صحت‌سنجی
│   ├── model.server.ts                    ← بارگذاری/cache مدل + schemaGuard
│   ├── modelTypes.ts                      ← ساختار فایل مدل
│   ├── ensemble.ts                        ← مفسر درخت‌های JSON (بدون وابستگی)
│   ├── features.ts                        ← نگاشت پاسخ ارزیابی → بردار ویژگی
│   ├── engine.ts                          ← هماهنگ‌کنندهٔ کل مسیر
│   ├── archetypes.ts                      ← ساختار هفتگی هر برنامه (۲۰ قالب)
│   ├── nutrition.ts                       ← ساختار تغذیه ۵ استراتژی
│   ├── guardrails.ts                      ← ایمنی/محدودیت‌ها
│   ├── explain.ts                         ← «چرا این انتخاب؟»
│   ├── requestSchema.ts                   ← اعتبارسنجی ورودی (zod)
│   ├── rules.ts                           ← fallback قاعده‌محور
│   ├── schemaGuard.ts                     ← چک هم‌خوانی مدل و کد
│   └── store.server.ts                    ← ثبت تصمیم در MySQL
│
├── src/routes/api/recommend.ts            ← endpoint: POST/GET /api/recommend
├── src/routes/recommendation.tsx          ← صفحه دمو: /recommendation
├── scripts/check-model-parity.mjs         ← تست برابری TS ↔ sklearn
├── scripts/e2e-plan.mjs                   ← تست end-to-end روی سرور با MySQL
├── scripts/verify-prod.mjs                ← اسموکتست بعد از deploy
└── database/migrations/mysql/
    └── 003_fitlytix_recommendation_engine.sql
```

## ۲) سریع‌ترین راه پیدا کردن فایل‌ها

```sh
cd ~/fitlytix-app
git fetch origin arena/9adac5a4-fitlytix-foundation
git checkout arena/9adac5a4-fitlytix-foundation

# دیدن کل کد موتور
ls -R ml src/services/recommendation

# دیدن فایل‌ها با شماره خط
sed -n '1,120p' src/services/recommendation/engine.ts

# پیدا کردن یک تابع
grep -rn "export function recommendPlan" src/services/recommendation
```

## ۳) ترتیب پیشنهادی خواندن

1. `docs/ml-recommendation-engine-fa.md` — معماری و API (این سند تصویر کلی می‌دهد).
2. `src/domain/recommendation.ts` — قرارداد ورودی/خروجی.
3. `src/services/recommendation/engine.ts` — مسیر کامل از ارزیابی تا پیشنهاد.
4. `src/services/recommendation/features.ts` — اینکه هر پاسخ ارزیابی چه عددی می‌شود.
5. `src/services/recommendation/archetypes.ts` + `nutrition.ts` — محتوای برنامه و تغذیه.
6. `ml/fitlytix_ml/schema.py` → `simulator.py` → `train.py` — اینکه مدل چطور ساخته می‌شود.
7. `src/services/recommendation/ensemble.ts` — چطور مدل در Node اجرا می‌شود.

## ۴) لینک مستقیم در GitHub

شاخه: `arena/9adac5a4-fitlytix-foundation`

- https://github.com/rezashookhcheshm71-dotcom/fitlytix-foundation/tree/arena/9adac5a4-fitlytix-foundation/src/services/recommendation
- https://github.com/rezashookhcheshm71-dotcom/fitlytix-foundation/tree/arena/9adac5a4-fitlytix-foundation/ml
- https://github.com/rezashookhcheshm71-dotcom/fitlytix-foundation/blob/arena/9adac5a4-fitlytix-foundation/src/routes/api/recommend.ts

## ۵) اگر فقط می‌خواهید اجرا شود

```sh
git pull
npm ci
npm run build
touch tmp/restart.txt     # یا Restart در cPanel
curl -s https://app.fitlytix.ir/api/recommend | head -c 200
```

مدل داخل بیلد باندل می‌شود؛ `ml/` و پایتون فقط برای آموزش مجدد لازم‌اند.
