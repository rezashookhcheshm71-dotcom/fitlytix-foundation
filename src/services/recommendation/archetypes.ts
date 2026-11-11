/**
 * Sport structure for every program archetype the model can choose.
 *
 * The model decides *which* archetype fits an athlete; this file defines what that
 * archetype actually looks like as a week of training. Keeping the two separate
 * means retraining never silently changes a published programme, and coaches can
 * review templates without touching the model.
 *
 * Movement names reuse the shared exercise catalog naming where an ID exists.
 */
import type { ProgramDayTemplate } from "@/domain/recommendation";

export interface ArchetypeTemplate {
  id: string;
  days: ProgramDayTemplate[];
  progressionNotes: string[];
  deloadEveryWeeks: number;
}

const day = (
  index: number,
  titleFa: string,
  focusFa: string,
  blocks: ProgramDayTemplate["blocks"],
  mainMovements: string[],
): ProgramDayTemplate => ({ index, titleFa, focusFa, blocks, mainMovements });

export const ARCHETYPE_TEMPLATES: Record<string, ArchetypeTemplate> = {
  /* ---------------------------------------------------------------- CrossFit */
  cf_foundation: {
    id: "cf_foundation",
    days: [
      day(
        1,
        "پایه · اسکوات و پرس",
        "الگوی درست پیش از وزنه",
        ["warmup", "strength", "skill", "cooldown"],
        ["Back Squat", "Strict Press", "Ring Row"],
      ),
      day(
        2,
        "موتور سبک و تکنیک",
        "تنفس و ریتم ثابت",
        ["warmup", "engine", "skill", "cooldown"],
        ["Row intervals", "Kip Swing", "Toes-to-Bar progression"],
      ),
      day(
        3,
        "WOD مقیاس‌شده",
        "تمام کردن با فرم تمیز",
        ["warmup", "wod", "cooldown"],
        ["AMRAP 12", "Farmer Carry", "Plank"],
      ),
    ],
    progressionNotes: [
      "هفته ۱–۲: فقط کیفیت حرکت و آشنایی با اسکیلینگ.",
      "هفته ۳–۴: ۵–۱۰٪ اضافه بار روی حرکات اصلی، بدون تغییر فرمت WOD.",
      "هر ۴ هفته یک هفته سبک‌تر برای تثبیت تکنیک.",
    ],
    deloadEveryWeeks: 4,
  },
  cf_strength_skill: {
    id: "cf_strength_skill",
    days: [
      day(
        1,
        "قدرت · اسکوات",
        "درصدهای ثابت و تکرار کم",
        ["warmup", "strength", "cooldown"],
        ["Back Squat", "Tempo Squat", "Split Squat"],
      ),
      day(
        2,
        "وزنه‌برداری",
        "تکنیک Clean و Snatch",
        ["warmup", "weightlifting", "skill", "cooldown"],
        ["Clean & Jerk", "Snatch", "Front Squat"],
      ),
      day(
        3,
        "ژیمناستیک",
        "پیشرفت مهارت با تکرار کنترل‌شده",
        ["warmup", "skill", "engine", "cooldown"],
        ["Strict Pull-up", "HSPU", "Hollow Hold"],
      ),
      day(
        4,
        "WOD کوتاه سنگین",
        "انتقال قدرت به متکان",
        ["warmup", "wod", "cooldown"],
        ["Thruster", "Chest-to-Bar", "Box Jump"],
      ),
    ],
    progressionNotes: [
      "قدرت با درصد ۱RM برنامه‌ریزی می‌شود؛ اگر رکورد نداریم، RPE 7–8 معیار است.",
      "مهارت‌ها هفته‌ای یک پیشرفت مشخص دارند (مثلاً از Kip به Chest-to-Bar).",
      "هفته چهارم: حجم ۴۰٪ کمتر، شدت حفظ می‌شود.",
    ],
    deloadEveryWeeks: 4,
  },
  cf_engine_competition: {
    id: "cf_engine_competition",
    days: [
      day(
        1,
        "اینتروال موتور",
        "پیس ثابت در بازه‌های طولانی",
        ["warmup", "engine", "cooldown"],
        ["Row 4×1000m", "Bike intervals"],
      ),
      day(
        2,
        "متکان طولانی",
        "مدیریت توان و تنفس",
        ["warmup", "wod", "cooldown"],
        ["20 min AMRAP", "Wall Ball", "Double Under"],
      ),
      day(
        3,
        "قدرت زیر خستگی",
        "حفظ فرم وقتی خسته‌ای",
        ["warmup", "strength", "wod", "cooldown"],
        ["Deadlift", "Clean", "Burpee"],
      ),
      day(
        4,
        "مهارت زیر خستگی",
        "اجرای مهارت با ضربان بالا",
        ["warmup", "skill", "engine", "cooldown"],
        ["Muscle-up", "Handstand Walk", "Rope Climb"],
      ),
      day(
        5,
        "شبیه‌سازی مسابقه",
        "ترکیب کامل روز مسابقه",
        ["warmup", "wod", "cooldown"],
        ["Multi-round simulation", "Sled", "Carry"],
      ),
    ],
    progressionNotes: [
      "۷۰–۸۰٪ جلسات هوازی در Zone 2 نگه داشته می‌شود؛ بقیه شدت بالا.",
      "هر ۳ هفته بار هفته ۲۰٪ کم می‌شود تا شبیه‌سازی مسابقه معنی‌دار بماند.",
      "اگر RPE میانگین بالای ۸.۵ رفت، حجم هفته بعد کاهش می‌یابد.",
    ],
    deloadEveryWeeks: 3,
  },
  cf_balanced_performance: {
    id: "cf_balanced_performance",
    days: [
      day(
        1,
        "قدرت",
        "پایه قدرتی هفته",
        ["warmup", "strength", "cooldown"],
        ["Back Squat", "Bench Press", "Row"],
      ),
      day(
        2,
        "موتور",
        "ظرفیت هوازی",
        ["warmup", "engine", "cooldown"],
        ["Run intervals", "Row", "Bike"],
      ),
      day(
        3,
        "مهارت",
        "یک مهارت هدف",
        ["warmup", "skill", "cooldown"],
        ["Pull-up", "HSPU", "Double Under"],
      ),
      day(
        4,
        "WOD ترکیبی",
        "همه‌چیز در یک جلسه",
        ["warmup", "wod", "cooldown"],
        ["Mixed modal WOD", "Kettlebell", "Carry"],
      ),
    ],
    progressionNotes: [
      "چرخش ۴ هفته‌ای: قدرت → موتور → مهارت → تثبیت.",
      "شدت WOD بین RPE 7 تا 8.5 می‌ماند.",
      "هفته چهارم دیلود ملایم با حفظ یک جلسه شدت.",
    ],
    deloadEveryWeeks: 4,
  },

  /* ------------------------------------------------------------------- Hyrox */
  hx_base_engine: {
    id: "hx_base_engine",
    days: [
      day(
        1,
        "دویدن آسان",
        "ساخت پایه هوازی",
        ["warmup", "engine", "cooldown"],
        ["Easy Run", "Strides"],
      ),
      day(
        2,
        "قدرت پایه",
        "پا و مرکز بدن",
        ["warmup", "strength", "cooldown"],
        ["Goblet Squat", "Split Squat", "Plank"],
      ),
      day(
        3,
        "دایره سبک ایستگاهی",
        "آشنایی با ایستگاه‌ها",
        ["warmup", "wod", "cooldown"],
        ["SkiErg", "Row", "Wall Ball light"],
      ),
    ],
    progressionNotes: [
      "مسافت هفتگی حداکثر ۱۰٪ در هفته اضافه می‌شود.",
      "شدت ایستگاه‌ها سبک است؛ هدف تحمل و تکنیک است، نه زمان.",
      "هر ۴ هفته یک هفته کاهش حجم.",
    ],
    deloadEveryWeeks: 4,
  },
  hx_station_strength: {
    id: "hx_station_strength",
    days: [
      day(
        1,
        "سورتمه و کرری",
        "قدرت کاربردی",
        ["warmup", "strength", "cooldown"],
        ["Sled Push", "Sled Pull", "Farmer Carry"],
      ),
      day(
        2,
        "دویدن با کیفیت",
        "پیوند دویدن و قدرت",
        ["warmup", "engine", "cooldown"],
        ["Tempo Run", "Hill Sprint"],
      ),
      day(
        3,
        "لانژ و وال‌بال",
        "استقامت عضلانی",
        ["warmup", "strength", "wod", "cooldown"],
        ["Sandbag Lunge", "Wall Ball", "Burpee Broad Jump"],
      ),
      day(
        4,
        "ترکیب ایستگاهی",
        "حفظ فرم زیر خستگی",
        ["warmup", "wod", "cooldown"],
        ["Station circuit", "Row", "Carry"],
      ),
    ],
    progressionNotes: [
      "بار سورتمه و کرری هفتگی ۵–۱۰٪ بالا می‌رود تا فرم نشکند.",
      "دویدن با کیفیت حداکثر دو جلسه در هفته.",
      "هفته چهارم: حجم ایستگاه‌ها ۴۰٪ کمتر.",
    ],
    deloadEveryWeeks: 4,
  },
  hx_race_prep: {
    id: "hx_race_prep",
    days: [
      day(
        1,
        "دویدن با pace مسابقه",
        "پیس ثابت بین ایستگاه‌ها",
        ["warmup", "engine", "cooldown"],
        ["Race pace intervals", "1K repeats"],
      ),
      day(
        2,
        "ایستگاه‌های اصلی",
        "قدرت مسابقه‌ای",
        ["warmup", "strength", "cooldown"],
        ["Sled Push", "Sandbag Lunge", "Wall Ball"],
      ),
      day(
        3,
        "شبیه‌سازی نیمی از مسابقه",
        "ترنزیشن و مدیریت توان",
        ["warmup", "wod", "cooldown"],
        ["Half simulation", "SkiErg", "Burpee Broad Jump"],
      ),
      day(
        4,
        "موتور طولانی",
        "ظرفیت هوازی",
        ["warmup", "engine", "cooldown"],
        ["Long Run", "Row steady"],
      ),
      day(
        5,
        "شبیه‌سازی کامل",
        "تمرین روز مسابقه",
        ["warmup", "wod", "cooldown"],
        ["Full simulation", "Compromised running"],
      ),
    ],
    progressionNotes: [
      "شبیه‌سازی کامل حداکثر هر ۲ هفته یک بار.",
      "دو هفته آخر حجم ۳۰٪ کم و پیس مسابقه حفظ می‌شود.",
      "اگر خواب یا آمادگی افت کرد، جلسه شبیه‌سازی به ایستگاه سبک تبدیل می‌شود.",
    ],
    deloadEveryWeeks: 3,
  },
  hx_hybrid_maintenance: {
    id: "hx_hybrid_maintenance",
    days: [
      day(
        1,
        "موتور کوتاه",
        "حفظ آمادگی هوازی",
        ["warmup", "engine", "cooldown"],
        ["Row intervals", "Easy Run"],
      ),
      day(
        2,
        "قدرت ایستگاهی",
        "حفظ قدرت کاربردی",
        ["warmup", "strength", "cooldown"],
        ["Sled Push", "Farmer Carry", "Split Squat"],
      ),
      day(
        3,
        "دایره ترکیبی",
        "نگهداشت توان",
        ["warmup", "wod", "cooldown"],
        ["Station circuit", "Wall Ball", "Row"],
      ),
    ],
    progressionNotes: [
      "حجم کم، شدت متوسط؛ هدف نگهداشت است نه پیشرفت سریع.",
      "اگر یک هفته جا افتاد، جبران با دو جلسه پشت‌سرهم انجام نمی‌شود.",
    ],
    deloadEveryWeeks: 6,
  },

  /* ------------------------------------------------------------- Functional */
  fn_movement_foundation: {
    id: "fn_movement_foundation",
    days: [
      day(
        1,
        "حرکت پایه",
        "اسکوات و هیپ",
        ["warmup", "skill", "strength", "cooldown"],
        ["Goblet Squat", "Hip Hinge", "Dead Bug"],
      ),
      day(
        2,
        "موبیلیتی و تعادل",
        "دامنه حرکت",
        ["warmup", "skill", "cooldown"],
        ["Ankle Mobility", "Single-leg Balance", "Thoracic Rotation"],
      ),
      day(
        3,
        "دایره سبک",
        "تنفس و استقامت پایه",
        ["warmup", "engine", "cooldown"],
        ["Step-up", "Band Row", "Easy Bike"],
      ),
    ],
    progressionNotes: [
      "دو هفته اول فقط الگو و دامنه؛ بار اضافه نمی‌شود.",
      "پیشرفت با افزایش کنترل و تکرار سنجیده می‌شود، نه وزن.",
      "هر ۴ هفته بازآزمایی حرکت.",
    ],
    deloadEveryWeeks: 4,
  },
  fn_strength_balance: {
    id: "fn_strength_balance",
    days: [
      day(
        1,
        "قدرت پایین‌تنه",
        "یک‌طرفه و ثبات",
        ["warmup", "strength", "cooldown"],
        ["Bulgarian Split Squat", "Hip Thrust", "Suitcase Carry"],
      ),
      day(
        2,
        "قدرت بالاتنه",
        "کشش و فشار متعادل",
        ["warmup", "strength", "cooldown"],
        ["Floor Press", "Row", "Overhead Carry"],
      ),
      day(
        3,
        "مرکز بدن و تعادل",
        "انتقال نیرو",
        ["warmup", "skill", "engine", "cooldown"],
        ["Pallof Press", "Single-leg RDL", "Farmer Walk"],
      ),
    ],
    progressionNotes: [
      "بار هفتگی ۲.۵–۵٪ اضافه می‌شود اگر فرم ثابت ماند.",
      "سمت ضعیف‌تر اول تمرین می‌شود.",
    ],
    deloadEveryWeeks: 4,
  },
  fn_conditioning_gpp: {
    id: "fn_conditioning_gpp",
    days: [
      day(
        1,
        "دایره تمام‌بدن",
        "ظرفیت کاری",
        ["warmup", "wod", "cooldown"],
        ["Kettlebell Swing", "Step-up", "Row"],
      ),
      day(
        2,
        "قدرت سبک",
        "حفظ قدرت پایه",
        ["warmup", "strength", "cooldown"],
        ["Goblet Squat", "Push-up", "Band Pull-apart"],
      ),
      day(
        3,
        "اینتروال هوازی",
        "نفس و ریکاوری",
        ["warmup", "engine", "cooldown"],
        ["Bike intervals", "SkiErg"],
      ),
      day(
        4,
        "دایره کوتاه",
        "شدت کنترل‌شده",
        ["warmup", "wod", "cooldown"],
        ["AMRAP 10", "Carry", "Plank"],
      ),
    ],
    progressionNotes: ["هفته‌های ۱–۲ حجم، هفته‌های ۳–۴ شدت.", "حداکثر دو جلسه شدت بالا در هفته."],
    deloadEveryWeeks: 4,
  },
  fn_mobility_recovery: {
    id: "fn_mobility_recovery",
    days: [
      day(
        1,
        "موبیلیتی هدفمند",
        "بازگرداندن دامنه",
        ["warmup", "skill", "cooldown"],
        ["Hip Mobility", "Shoulder CARs", "Breathing Drill"],
      ),
      day(
        2,
        "قدرت سبک",
        "تحمل بار بدون درد",
        ["warmup", "strength", "cooldown"],
        ["Box Squat", "Band Row", "Glute Bridge"],
      ),
      day(
        3,
        "پیاده‌روی و کنترل",
        "گردش خون و تعادل",
        ["warmup", "engine", "cooldown"],
        ["Walk", "Single-leg Balance", "Stretch"],
      ),
    ],
    progressionNotes: [
      "هیچ حرکتی نباید درد بالای ۳ از ۱۰ ایجاد کند.",
      "پیشرفت هفتگی فقط با کاهش درد و افزایش دامنه سنجیده می‌شود.",
      "در صورت تداوم درد، ارجاع به متخصص لازم است.",
    ],
    deloadEveryWeeks: 4,
  },

  /* ----------------------------------------------------------- Bodybuilding */
  bb_full_body_foundation: {
    id: "bb_full_body_foundation",
    days: [
      day(
        1,
        "تمام بدن A",
        "الگوهای اصلی",
        ["warmup", "strength", "cooldown"],
        ["Goblet Squat", "Dumbbell Bench Press", "Lat Pulldown"],
      ),
      day(
        2,
        "تمام بدن B",
        "هیپ و کشش",
        ["warmup", "strength", "cooldown"],
        ["Romanian Deadlift", "Seated Row", "Shoulder Press"],
      ),
      day(
        3,
        "تمام بدن C",
        "بازو و مرکز بدن",
        ["warmup", "strength", "cooldown"],
        ["Split Squat", "Incline Press", "Curl + Triceps"],
      ),
    ],
    progressionNotes: [
      "۲–۳ ست در محدوده ۸–۱۲ تکرار با RIR ۲.",
      "افزایش بار وقتی همه ست‌ها در بالای محدوده تکرار انجام شد.",
      "هفته چهارم حجم ۳۰٪ کمتر.",
    ],
    deloadEveryWeeks: 4,
  },
  bb_upper_lower: {
    id: "bb_upper_lower",
    days: [
      day(
        1,
        "بالاتنه قدرتی",
        "فشار سنگین",
        ["warmup", "strength", "cooldown"],
        ["Bench Press", "Row", "Overhead Press"],
      ),
      day(
        2,
        "پایین‌تنه قدرتی",
        "اسکوات و هیپ",
        ["warmup", "strength", "cooldown"],
        ["Back Squat", "Romanian Deadlift", "Leg Curl"],
      ),
      day(
        3,
        "بالاتنه حجمی",
        "تنش و کنترل",
        ["warmup", "strength", "cooldown"],
        ["Incline Dumbbell Press", "Lat Pulldown", "Lateral Raise"],
      ),
      day(
        4,
        "پایین‌تنه حجمی",
        "دامنه و تقارن",
        ["warmup", "strength", "cooldown"],
        ["Leg Press", "Hip Thrust", "Calf Raise"],
      ),
    ],
    progressionNotes: [
      "جلسات قدرتی ۴–۶ تکرار، جلسات حجمی ۸–۱۵ تکرار.",
      "حجم هفتگی هر گروه عضلانی ۱۰–۲۰ ست می‌ماند.",
      "دیلود هر ۵ هفته.",
    ],
    deloadEveryWeeks: 5,
  },
  bb_push_pull_legs: {
    id: "bb_push_pull_legs",
    days: [
      day(
        1,
        "فشار",
        "سینه، سرشانه، پشت‌بازو",
        ["warmup", "strength", "cooldown"],
        ["Bench Press", "Incline Press", "Lateral Raise"],
      ),
      day(2, "کشش", "پشت و بازو", ["warmup", "strength", "cooldown"], ["Pull-up", "Row", "Curl"]),
      day(
        3,
        "پا",
        "چهارسر و همسترینگ",
        ["warmup", "strength", "cooldown"],
        ["Squat", "Romanian Deadlift", "Leg Extension"],
      ),
      day(
        4,
        "فشار حجمی",
        "تکرار بالا و کنترل",
        ["warmup", "strength", "cooldown"],
        ["Dumbbell Press", "Fly", "Triceps"],
      ),
      day(
        5,
        "کشش حجمی + پا سبک",
        "تقارن و پمپ",
        ["warmup", "strength", "cooldown"],
        ["Cable Row", "Face Pull", "Leg Curl"],
      ),
    ],
    progressionNotes: [
      "حجم بالا نیاز به خواب و تغذیه کافی دارد؛ اگر افت عملکرد دیدی، یک ست از هر حرکت کم کن.",
      "هفته چهارم حجم ۴۰٪ کمتر با حفظ شدت.",
    ],
    deloadEveryWeeks: 4,
  },
  bb_weak_point: {
    id: "bb_weak_point",
    days: [
      day(
        1,
        "اولویت اول",
        "حجم اختصاصی",
        ["warmup", "strength", "cooldown"],
        ["Weak-point lift", "Isolation", "Stretch"],
      ),
      day(
        2,
        "بالاتنه متعادل",
        "حفظ تناسب",
        ["warmup", "strength", "cooldown"],
        ["Bench Press", "Row", "Lateral Raise"],
      ),
      day(
        3,
        "اولویت دوم",
        "حجم اختصاصی",
        ["warmup", "strength", "cooldown"],
        ["Second priority lift", "Tempo work", "Core"],
      ),
      day(
        4,
        "پایین‌تنه",
        "قدرت پایه",
        ["warmup", "strength", "cooldown"],
        ["Squat", "Hip Thrust", "Calf Raise"],
      ),
    ],
    progressionNotes: [
      "عضلات عقب‌مانده ۲ بار در هفته و اول جلسه تمرین می‌شوند.",
      "حجم اضافه فقط اگر ریکاوری و خواب کافی بود.",
    ],
    deloadEveryWeeks: 4,
  },

  /* ---------------------------------------------------------------- Running */
  rn_base_build: {
    id: "rn_base_build",
    days: [
      day(
        1,
        "دوی آسان",
        "ساخت پایه هوازی",
        ["warmup", "engine", "cooldown"],
        ["Easy Run", "Strides"],
      ),
      day(
        2,
        "قدرت مکمل",
        "ثبات لگن و ساق",
        ["warmup", "strength", "cooldown"],
        ["Split Squat", "Calf Raise", "Single-leg RDL"],
      ),
      day(3, "دوی طولانی سبک", "تحمل هوازی", ["warmup", "engine", "cooldown"], ["Long Easy Run"]),
    ],
    progressionNotes: [
      "مسافت هفتگی حداکثر ۱۰٪ رشد می‌کند.",
      "۸۰٪ دویدن‌ها باید قابل گفتگو باشند.",
      "هر ۴ هفته یک هفته کاهش حجم ۲۵٪.",
    ],
    deloadEveryWeeks: 4,
  },
  rn_threshold_5k10k: {
    id: "rn_threshold_5k10k",
    days: [
      day(1, "اینتروال", "سرعت و VO2max", ["warmup", "engine", "cooldown"], ["5×800m", "Strides"]),
      day(2, "دوی آسان", "ریکاوری فعال", ["warmup", "engine", "cooldown"], ["Easy Run"]),
      day(3, "تمپو", "آستانه لاکتات", ["warmup", "engine", "cooldown"], ["Tempo 20 min"]),
      day(
        4,
        "قدرت و پیشگیری از آسیب",
        "ثبات",
        ["warmup", "strength", "cooldown"],
        ["Single-leg RDL", "Calf Raise", "Core"],
      ),
    ],
    progressionNotes: [
      "یک جلسه کیفیت اضافه در هفته ممنوع؛ بین دو جلسه شدید حداقل ۴۸ ساعت.",
      "تمپو با RPE 6–7 اجرا می‌شود.",
      "دو هفته قبل از مسابقه حجم ۲۵٪ کم می‌شود.",
    ],
    deloadEveryWeeks: 4,
  },
  rn_half_marathon: {
    id: "rn_half_marathon",
    days: [
      day(1, "لانگ‌ران", "تحمل مسافت", ["warmup", "engine", "cooldown"], ["Long Run"]),
      day(2, "دوی آسان", "ریکاوری", ["warmup", "engine", "cooldown"], ["Easy Run"]),
      day(
        3,
        "تمپو / ماراتن‌پیست",
        "پیس هدف",
        ["warmup", "engine", "cooldown"],
        ["Tempo", "Race pace blocks"],
      ),
      day(4, "اینتروال سبک", "اقتصاد دویدن", ["warmup", "engine", "cooldown"], ["6×400m"]),
      day(
        5,
        "قدرت مکمل",
        "پایداری مفاصل",
        ["warmup", "strength", "cooldown"],
        ["Hip Thrust", "Calf Raise", "Core"],
      ),
    ],
    progressionNotes: [
      "لانگ‌ران هر هفته بیشتر از ۱۰٪ رشد نمی‌کند.",
      "هفته سوم هر ۴ هفته کاهش حجم ۳۰٪.",
      "دو هفته آخر تیپر با حفظ یک جلسه پیس مسابقه.",
    ],
    deloadEveryWeeks: 4,
  },
  rn_speed_maintenance: {
    id: "rn_speed_maintenance",
    days: [
      day(1, "اینتروال کوتاه", "حفظ سرعت", ["warmup", "engine", "cooldown"], ["8×200m"]),
      day(2, "دوی آسان", "حفظ پایه", ["warmup", "engine", "cooldown"], ["Easy Run"]),
      day(
        3,
        "قدرت سبک",
        "پیشگیری از آسیب",
        ["warmup", "strength", "cooldown"],
        ["Split Squat", "Calf Raise", "Core"],
      ),
    ],
    progressionNotes: [
      "هدف نگهداشت است؛ حجم ثابت می‌ماند.",
      "اگر یک هفته از دست رفت، با شدت بالا جبران نکن.",
    ],
    deloadEveryWeeks: 6,
  },
};

/** Safe default when a retrained model introduces an id the UI does not know yet. */
export function getArchetypeTemplate(id: string, sportIds: string[]): ArchetypeTemplate {
  const direct = ARCHETYPE_TEMPLATES[id];
  if (direct) return direct;
  for (const candidate of sportIds) {
    const template = ARCHETYPE_TEMPLATES[candidate];
    if (template) return template;
  }
  return ARCHETYPE_TEMPLATES["cf_foundation"]!;
}
