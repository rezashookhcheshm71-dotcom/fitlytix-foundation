/**
 * Nutrition structure keyed by the model's strategy output.
 *
 * Scope discipline (same rule as the rest of the platform): this produces
 * *structure and ranges*, never a calorie prescription, never a medical claim.
 * Everything is expressed per kilogram of body weight so a coach or dietitian can
 * review it, and the UI must show the disclaimer returned in `notes`.
 */
import type { SportId } from "@/domain/types";
import type {
  DayTypeNutrition,
  MealSlotTemplate,
  NutritionRecommendation,
  NutritionStrategyId,
} from "@/domain/recommendation";

interface StrategyMeta {
  id: NutritionStrategyId;
  labelFa: string;
  summaryFa: string;
  energyIntentFa: string;
  protein: [number, number];
  carb: [number, number];
  fat: [number, number];
  meals: MealSlotTemplate[];
  weeklyAdjustments: string[];
  sportNotes: Partial<Record<SportId, string[]>>;
}

const MEAL = (
  titleFa: string,
  timingFa: string,
  templateFa: string,
  focus: MealSlotTemplate["focus"],
): MealSlotTemplate => ({ titleFa, timingFa, templateFa, focus });

const BREAKFAST = (focus: MealSlotTemplate["focus"]): MealSlotTemplate =>
  MEAL("صبحانه", "۳۰–۶۰ دقیقه بعد از بیدار شدن", "پروتئین + کربوهیدرات کامل + میوه", focus);

const STRATEGIES: Record<NutritionStrategyId, StrategyMeta> = {
  fat_loss_deficit: {
    id: "fat_loss_deficit",
    labelFa: "کاهش چربی با کسری کنترل‌شده",
    summaryFa: "کسری ملایم، پروتئین بالا و حفظ عملکرد تمرین؛ بدون گرسنگی شدید.",
    energyIntentFa: "کسری انرژی حدود ۱۰ تا ۲۰ درصد نسبت به نیاز تقریبی",
    protein: [2.0, 2.4],
    carb: [2.0, 3.0],
    fat: [0.7, 0.9],
    meals: [
      BREAKFAST("protein"),
      MEAL("ناهار", "وسط روز", "پروتئین کامل + سبزیجات زیاد + کربوهیدرات متوسط", "balanced"),
      MEAL("قبل تمرین", "۶۰–۹۰ دقیقه قبل", "کربوهیدرات سبک و کم‌چرب", "carb"),
      MEAL(
        "بعد تمرین / شام",
        "تا ۲ ساعت بعد",
        "پروتئین + کربوهیدرات متناسب با شدت جلسه",
        "protein",
      ),
    ],
    weeklyAdjustments: [
      "هر دو هفته وزن و دور کمر اندازه‌گیری شود؛ تغییر بیش از ۰.۷٪ وزن در هفته معمولاً سریع است.",
      "در هفته‌های پرحجم، کربوهیدرات را حذف نکن؛ کسری را از چربی و وعده‌های اضافه بگیر.",
    ],
    sportNotes: {
      running: ["قبل از دوی طولانی کربوهیدرات سبک را حذف نکن؛ کسری شدید کیفیت جلسه را می‌شکند."],
      crossfit: [
        "در روزهای متکان طولانی، کربوهیدرات قبل تمرین را نگه دار و کسری را به روز استراحت منتقل کن.",
      ],
      bodybuilding: ["پروتئین را روی ۴ وعده تقسیم کن تا در کسری، توده عضلانی حفظ شود."],
    },
  },
  lean_gain: {
    id: "lean_gain",
    labelFa: "افزایش وزن تدریجی و عضله‌سازی",
    summaryFa: "مازاد انرژی کنترل‌شده با کربوهیدرات کافی و پروتئین پخش‌شده در روز.",
    energyIntentFa: "مازاد انرژی حدود ۸ تا ۱۵ درصد با رشد آهسته و قابل کنترل",
    protein: [1.8, 2.2],
    carb: [3.5, 5.0],
    fat: [0.9, 1.2],
    meals: [
      BREAKFAST("carb"),
      MEAL("قبل تمرین", "۹۰ دقیقه قبل", "کربوهیدرات اصلی + پروتئین سبک", "carb"),
      MEAL("بعد تمرین", "تا ۲ ساعت بعد", "پروتئین + کربوهیدرات سریع‌تر", "protein"),
      MEAL("ناهار / شام", "وعده اصلی", "پروتئین + برنج/سیب‌زمینی + چربی سالم", "balanced"),
    ],
    weeklyAdjustments: [
      "افزایش وزن هدف ۰.۲۵ تا ۰.۵ درصد وزن بدن در هفته است.",
      "اگر دو هفته وزن ثابت ماند، یک میان‌وعده کربوهیدراتی اضافه کن، نه یک وعده کامل.",
    ],
    sportNotes: {
      bodybuilding: [
        "پروتئین هر وعده حدود ۰.۴ گرم به ازای هر کیلو وزن بدن؛ حداقل ۳ وعده پروتئینی.",
      ],
      crossfit: ["کربوهیدرات اطراف جلسات شدید را نگه دار تا کیفیت WOD افت نکند."],
    },
  },
  performance_fuel: {
    id: "performance_fuel",
    labelFa: "سوخت عملکرد",
    summaryFa: "انرژی کافی برای جلسات شدید و مسابقه؛ اولویت با زمان‌بندی کربوهیدرات.",
    energyIntentFa: "انرژی در محدوده نگهداشت تا مازاد کوچک، بر اساس بار تمرین",
    protein: [1.6, 2.0],
    carb: [4.5, 7.0],
    fat: [0.9, 1.3],
    meals: [
      BREAKFAST("carb"),
      MEAL("قبل تمرین", "۲–۳ ساعت قبل", "وعده کربوهیدرات‌محور با پروتئین متوسط", "carb"),
      MEAL("حین/بعد تمرین", "بر اساس طول جلسه", "کربوهیدرات سریع در جلسات بالای ۷۵ دقیقه", "carb"),
      MEAL("بعد تمرین", "تا ۲ ساعت بعد", "پروتئین + کربوهیدرات برای بازسازی", "protein"),
      MEAL("شام", "عصر", "پروتئین + سبزیجات + چربی سالم", "balanced"),
    ],
    weeklyAdjustments: [
      "روزهای سنگین کربوهیدرات بیشتر، روزهای استراحت کمتر (کارب‌سایکلینگ ساده).",
      "دو هفته قبل مسابقه ساختار وعده‌ها را تغییر نده؛ فقط حجم را با بار تمرین تنظیم کن.",
    ],
    sportNotes: {
      running: ["جلسات بالای ۹۰ دقیقه: ۳۰ تا ۶۰ گرم کربوهیدرات در ساعت."],
      hyrox: ["بین ایستگاه‌ها و دویدن، کربوهیدرات سریع و الکترولیت برنامه‌ریزی شود."],
      crossfit: ["برای متکان‌های بالای ۲۰ دقیقه، ۲۰–۳۰ گرم کربوهیدرات قبل شروع."],
      functional: [
        "روی نظم وعده‌ها تمرکز کن؛ عملکرد در تمرین‌های کوتاه بیشتر به انرژی روزانه وابسته است.",
      ],
    },
  },
  maintenance: {
    id: "maintenance",
    labelFa: "نگهداشت و سلامت",
    summaryFa: "تعادل انرژی، پروتئین کافی و الگوی پایدار؛ بدون محدودیت سخت.",
    energyIntentFa: "انرژی در محدوده نگهداشت تقریبی",
    protein: [1.6, 2.0],
    carb: [3.0, 4.5],
    fat: [0.9, 1.2],
    meals: [
      BREAKFAST("balanced"),
      MEAL("ناهار", "وسط روز", "پروتئین + غلات کامل + سبزیجات", "balanced"),
      MEAL("میان‌وعده", "بعدازظهر", "میوه/ماست/آجیل", "light"),
      MEAL("شام", "عصر", "پروتئین + سبزیجات + کربوهیدرات متوسط", "balanced"),
    ],
    weeklyAdjustments: [
      "هفته‌ای یک بار الگوی وعده‌ها را مرور کن؛ هدف پایداری است نه تغییر سریع.",
      "در هفته‌های پرفشار، پروتئین را ثابت نگه دار و کربوهیدرات را کمی بالا ببر.",
    ],
    sportNotes: {
      functional: ["نظم وعده‌ها مهم‌تر از جزئیات ماکروها است."],
    },
  },
  recomp: {
    id: "recomp",
    labelFa: "بازترکیب بدن",
    summaryFa: "پروتئین بالا، انرژی نزدیک نگهداشت و بار تمرین باکیفیت برای تغییر ترکیب بدن.",
    energyIntentFa: "انرژی نزدیک نگهداشت با نوسان کوچک بر اساس روز تمرین",
    protein: [2.2, 2.6],
    carb: [2.5, 3.5],
    fat: [0.8, 1.0],
    meals: [
      BREAKFAST("protein"),
      MEAL("قبل تمرین", "۹۰ دقیقه قبل", "کربوهیدرات متوسط + پروتئین", "carb"),
      MEAL("بعد تمرین", "تا ۲ ساعت بعد", "پروتئین بالا + کربوهیدرات متوسط", "protein"),
      MEAL("شام", "عصر", "پروتئین + سبزیجات + چربی سالم", "balanced"),
    ],
    weeklyAdjustments: [
      "تغییر ترکیب بدن آهسته است؛ هر ۳–۴ هفته با اندازه‌گیری ارزیابی شود.",
      "روزهای استراحت کربوهیدرات کمی کمتر و پروتئین ثابت.",
    ],
    sportNotes: {
      bodybuilding: ["پروتئین را روی ۴ وعده پخش کن؛ RIR تمرین را زیر نظر بگیر."],
    },
  },
};

const DAY_TYPES: DayTypeNutrition[] = [
  {
    dayType: "hard",
    labelFa: "روز سنگین",
    carbMultiplier: 1.3,
    noteFa: "کربوهیدرات اطراف جلسه را کامل کن؛ وعده قبل تمرین حذف نشود.",
  },
  {
    dayType: "training",
    labelFa: "روز تمرین معمولی",
    carbMultiplier: 1.0,
    noteFa: "ساختار عادی روز؛ وعده بعد تمرین را جا نینداز.",
  },
  {
    dayType: "rest",
    labelFa: "روز استراحت",
    carbMultiplier: 0.75,
    noteFa: "پروتئین ثابت، کربوهیدرات کمی کمتر، سبزیجات بیشتر.",
  },
];

export interface NutritionBuildContext {
  sport: SportId;
  weightKg: number;
  mealsPerDay: number;
  goalLabelFa: string;
  restrictions?: string[] | undefined;
  strategyOverrideNote?: string | undefined;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function buildNutritionRecommendation(
  strategyId: NutritionStrategyId,
  ctx: NutritionBuildContext,
): NutritionRecommendation {
  const meta = STRATEGIES[strategyId] ?? STRATEGIES.maintenance;
  const sportNotes = meta.sportNotes[ctx.sport] ?? [];
  const hydrationL = round1(
    Math.min(
      4.5,
      Math.max(
        1.8,
        ctx.weightKg * 0.033 + (ctx.sport === "hyrox" || ctx.sport === "running" ? 0.4 : 0.2),
      ),
    ),
  );
  const meals = meta.meals.slice(0, Math.max(3, Math.min(5, Math.round(ctx.mealsPerDay))));

  const notes = [
    ...sportNotes,
    ...(ctx.restrictions && ctx.restrictions.length > 0
      ? [`محدودیت‌های ثبت‌شده در ساختار وعده‌ها لحاظ شود: ${ctx.restrictions.join("، ")}.`]
      : []),
    ...(ctx.strategyOverrideNote ? [ctx.strategyOverrideNote] : []),
    "این ساختار آموزشی است، نه تجویز پزشکی یا رژیم درمانی؛ در شرایط پزشکی یا بارداری با متخصص تغذیه مشورت شود.",
  ];

  return {
    strategyId: meta.id,
    labelFa: meta.labelFa,
    summaryFa: meta.summaryFa,
    energyIntentFa: meta.energyIntentFa,
    macros: [
      {
        id: "protein",
        labelFa: "پروتئین",
        gPerKg: meta.protein,
        roleFa: "حفظ و ساخت عضله و سیری",
      },
      {
        id: "carb",
        labelFa: "کربوهیدرات",
        gPerKg: [round1(meta.carb[0]), round1(meta.carb[1])],
        roleFa: "سوخت جلسات شدید و بازسازی گلیکوژن",
      },
      {
        id: "fat",
        labelFa: "چربی",
        gPerKg: meta.fat,
        roleFa: "تعادل هورمونی و انرژی پایدار",
      },
    ],
    hydrationL,
    mealsPerDay: meals.length,
    meals,
    dayTypes: DAY_TYPES,
    weeklyAdjustments: meta.weeklyAdjustments,
    notes,
  };
}

/** Strategy label lookup for the UI / explanation panel. */
export function nutritionStrategyLabel(id: NutritionStrategyId): string {
  return (STRATEGIES[id] ?? STRATEGIES.maintenance).labelFa;
}
