export { COMMON_ASSESSMENT, SPORT_ASSESSMENTS } from "./registry";
/* Legacy import path retained while templates now live in independent modules. */
/*
export const COMMON_ASSESSMENT = {
  id: "common-v1",
  scope: "common",
  sections: [
    {
      id: "profile",
      title: "پروفایل پایه",
      titleEn: "Profile",
      description: "اطلاعات بدنی و سابقه تمرینی",
      icon: "User",
      fields: [
        { id: "age", label: "سن", type: "number", unit: "سال", min: 12, max: 80 },
        { id: "height", label: "قد", type: "number", unit: "cm" },
        { id: "weight", label: "وزن", type: "number", unit: "kg" },
        {
          id: "training_age",
          label: "سابقه تمرین منظم",
          type: "select",
          options: ["کمتر از ۱ سال", "۱ تا ۳ سال", "۳ تا ۶ سال", "بیش از ۶ سال"],
        },
      ],
    },
    {
      id: "goals",
      title: "هدف‌ها",
      titleEn: "Goals",
      description: "می‌خواهی در ۱۲ هفته آینده به کجا برسی؟",
      icon: "Target",
      fields: [
        {
          id: "primary_goal",
          label: "هدف اصلی",
          type: "select",
          options: ["افزایش قدرت", "بهبود موتور", "کاهش چربی", "مسابقه", "سلامت عمومی"],
        },
        {
          id: "sessions_per_week",
          label: "تعداد جلسات در هفته",
          type: "scale",
          min: 2,
          max: 6,
        },
        { id: "session_length", label: "طول هر جلسه", type: "number", unit: "دقیقه" },
      ],
    },
    {
      id: "health",
      title: "سلامت و ریکاوری",
      titleEn: "Health",
      description: "خواب، آسیب‌ها و محدودیت‌ها",
      icon: "HeartPulse",
      fields: [
        { id: "sleep", label: "میانگین خواب", type: "number", unit: "ساعت" },
        { id: "stress", label: "سطح استرس روزانه", type: "scale", min: 1, max: 10 },
        { id: "injuries", label: "آسیب فعلی یا سابقه‌دار", type: "text" },
        {
          id: "limitations",
          label: "محدودیت حرکتی",
          type: "multiselect",
          options: ["شانه", "زانو", "کمر", "مچ", "لگن", "ندارم"],
        },
      ],
    },
  ],
};
*/

const crossfitSections: AssessmentSection[] = [
  {
    id: "warmup",
    title: "گرم کردن و تحرک",
    titleEn: "Warm-up",
    description: "کیفیت آماده‌سازی و دامنه حرکتی",
    icon: "Sunrise",
    blockToken: "warmup",
    fields: [
      { id: "overhead_mobility", label: "دامنه حرکتی بالای سر", type: "scale", min: 1, max: 5 },
      { id: "squat_depth", label: "عمق اسکوات", type: "select", options: ["بالای موازی", "موازی", "کامل"] },
    ],
  },
  {
    id: "bodybuilding",
    title: "بدنسازی و قدرت پایه",
    titleEn: "Bodybuilding",
    description: "حجم، کنترل و ضعف‌های عضلانی",
    icon: "Dumbbell",
    blockToken: "strength",
    fields: [
      { id: "strict_pullups", label: "بارفیکس استریکت (حداکثر)", type: "number", unit: "تکرار" },
      { id: "strict_pushups", label: "شنا (حداکثر)", type: "number", unit: "تکرار" },
      { id: "weak_muscles", label: "ضعف عضلانی", type: "multiselect", options: ["پشت", "سینه", "پا", "شانه", "مرکز"] },
    ],
  },
  {
    id: "engine",
    title: "موتور (Engine)",
    titleEn: "Engine",
    description: "ظرفیت هوازی و تحمل",
    icon: "Wind",
    blockToken: "engine",
    fields: [
      { id: "row_2k", label: "Row 2k", type: "time", unit: "mm:ss" },
      { id: "run_5k", label: "Run 5k", type: "time", unit: "mm:ss", advancedOnly: true },
      { id: "bike_10min_cal", label: "Assault Bike 10min", type: "number", unit: "cal", advancedOnly: true },
    ],
  },
  {
    id: "wod",
    title: "WOD و بنچمارک‌ها",
    titleEn: "WOD",
    description: "نتایج ورک‌اوت‌های معیار",
    icon: "Flame",
    blockToken: "wod",
    fields: [
      { id: "fran", label: "Fran", type: "time", unit: "mm:ss", advancedOnly: true },
      { id: "grace", label: "Grace", type: "time", unit: "mm:ss", advancedOnly: true },
      { id: "cindy", label: "Cindy", type: "number", unit: "rounds", advancedOnly: true },
      { id: "murph", label: "Murph", type: "time", unit: "mm:ss", advancedOnly: true },
      { id: "scaling_pref", label: "سطح مقیاس معمول", type: "select", options: ["Rx", "Scaled", "Foundations"] },
    ],
  },
  {
    id: "skill",
    title: "مهارت‌ها",
    titleEn: "Skill",
    description: "ژیمناستیک و مهارت‌های پیشرفته",
    icon: "Sparkles",
    blockToken: "skill",
    fields: [
      {
        id: "skills_have",
        label: "مهارت‌هایی که داری",
        type: "multiselect",
        options: ["Kipping Pull-up", "C2B", "Bar MU", "Ring MU", "HSPU", "HS Walk", "Double Under", "Pistol", "T2B"],
      },
      { id: "du_max", label: "Double Under (بدون قطع)", type: "number", unit: "تکرار" },
      { id: "hs_hold", label: "ایستادن روی دست", type: "number", unit: "ثانیه", advancedOnly: true },
    ],
  },
  {
    id: "weightlifting",
    title: "وزنه‌برداری و PRها",
    titleEn: "Weightlifting",
    description: "رکوردهای شخصی لیفت‌های اصلی",
    icon: "Weight",
    blockToken: "weightlifting",
    fields: [
      { id: "back_squat", label: "Back Squat 1RM", type: "load", unit: "kg" },
      { id: "deadlift", label: "Deadlift 1RM", type: "load", unit: "kg" },
      { id: "clean_jerk", label: "Clean & Jerk 1RM", type: "load", unit: "kg", advancedOnly: true },
      { id: "snatch", label: "Snatch 1RM", type: "load", unit: "kg", advancedOnly: true },
      { id: "strict_press", label: "Strict Press 1RM", type: "load", unit: "kg" },
    ],
  },
  {
    id: "cooldown",
    title: "سرد کردن و ریکاوری",
    titleEn: "Cooldown",
    description: "عادت‌های بازیابی بعد از تمرین",
    icon: "Moon",
    blockToken: "cooldown",
    fields: [
      { id: "cooldown_habit", label: "بعد از تمرین سرد می‌کنی؟", type: "select", options: ["همیشه", "گاهی", "هرگز"] },
      { id: "recovery_tools", label: "ابزار ریکاوری", type: "multiselect", options: ["فوم رولر", "کشش", "سونا", "آب سرد", "ماساژ"] },
    ],
  },
];

export const SPORT_ASSESSMENTS: Record<string, AssessmentTemplate> = {
  crossfit: { id: "crossfit-v1", scope: "crossfit", sections: crossfitSections },
  hyrox: {
    id: "hyrox-v1",
    scope: "hyrox",
    sections: [
      {
        id: "running",
        title: "دویدن",
        titleEn: "Running",
        description: "پایه هوازی",
        icon: "Footprints",
        blockToken: "engine",
        fields: [{ id: "run_1k", label: "1k Pace", type: "time", unit: "mm:ss" }],
      },
      {
        id: "stations",
        title: "ایستگاه‌ها",
        titleEn: "Stations",
        description: "Sled, Wall Ball, Burpee Broad Jump",
        icon: "Grid3x3",
        blockToken: "wod",
        fields: [{ id: "wall_balls", label: "Wall Ball (بدون قطع)", type: "number", unit: "تکرار" }],
      },
    ],
  },
  functional: {
    id: "functional-v1",
    scope: "functional",
    sections: [
      {
        id: "movement",
        title: "کیفیت حرکت",
        titleEn: "Movement",
        description: "الگوهای پایه",
        icon: "Activity",
        blockToken: "warmup",
        fields: [{ id: "fms", label: "امتیاز غربالگری حرکتی", type: "scale", min: 1, max: 21 }],
      },
    ],
  },
  bodybuilding: {
    id: "bodybuilding-v1",
    scope: "bodybuilding",
    sections: [
      {
        id: "lifts",
        title: "لیفت‌های اصلی",
        titleEn: "Lifts",
        description: "قدرت پایه",
        icon: "Dumbbell",
        blockToken: "strength",
        fields: [{ id: "bench", label: "Bench Press 1RM", type: "load", unit: "kg" }],
      },
    ],
  },
  running: {
    id: "running-v1",
    scope: "running",
    sections: [
      {
        id: "pace",
        title: "پیس و مسافت",
        titleEn: "Pace",
        description: "رکوردهای اخیر",
        icon: "Timer",
        blockToken: "engine",
        fields: [{ id: "run_10k", label: "10k", type: "time", unit: "mm:ss" }],
      },
    ],
  },
};
