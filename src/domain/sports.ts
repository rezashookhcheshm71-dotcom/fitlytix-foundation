import type { Sport, SportId, WorkoutBlockType } from "./types";

/** Central sport registry. Visual tokens live in styles.css as --sport-* variables. */
export const SPORTS: Record<SportId, Sport> = {
  crossfit: {
    id: "crossfit",
    name: "CrossFit",
    nameFa: "کراس‌فیت",
    tagline: "قدرت، مهارت و موتور در یک برنامه",
    colorToken: "--sport-crossfit",
    cssClass: "sport-crossfit",
    icon: "Flame",
    assessmentSections: [
      "warmup",
      "bodybuilding",
      "engine",
      "wod",
      "skill",
      "weightlifting",
      "cooldown",
    ],
  },
  hyrox: {
    id: "hyrox",
    name: "Hyrox",
    nameFa: "هایراکس",
    tagline: "دویدن و ایستگاه‌های قدرتی استقامتی",
    colorToken: "--sport-hyrox",
    cssClass: "sport-hyrox",
    icon: "Timer",
    assessmentSections: ["running", "stations", "strength_endurance", "pacing"],
  },
  functional: {
    id: "functional",
    name: "Functional Training",
    nameFa: "تمرین فانکشنال",
    tagline: "حرکت بهتر، بدن کارآمدتر",
    colorToken: "--sport-functional",
    cssClass: "sport-functional",
    icon: "Activity",
    assessmentSections: ["movement", "mobility", "strength", "conditioning"],
  },
  bodybuilding: {
    id: "bodybuilding",
    name: "Bodybuilding",
    nameFa: "بدنسازی",
    tagline: "هایپرتروفی هدفمند و تقارن",
    colorToken: "--sport-bodybuilding",
    cssClass: "sport-bodybuilding",
    icon: "Dumbbell",
    assessmentSections: ["split", "volume", "lifts", "nutrition"],
  },
  running: {
    id: "running",
    name: "Running",
    nameFa: "دویدن",
    tagline: "سرعت، آستانه و استقامت",
    colorToken: "--sport-running",
    cssClass: "sport-running",
    icon: "Footprints",
    assessmentSections: ["distance", "pace", "zones", "injury"],
  },
};

export const SPORT_LIST: Sport[] = Object.values(SPORTS);

export const sportColorClass: Record<SportId, { text: string; bg: string; border: string }> = {
  crossfit: {
    text: "text-sport-crossfit",
    bg: "bg-sport-crossfit",
    border: "border-sport-crossfit",
  },
  hyrox: { text: "text-sport-hyrox", bg: "bg-sport-hyrox", border: "border-sport-hyrox" },
  functional: {
    text: "text-sport-functional",
    bg: "bg-sport-functional",
    border: "border-sport-functional",
  },
  bodybuilding: {
    text: "text-sport-bodybuilding",
    bg: "bg-sport-bodybuilding",
    border: "border-sport-bodybuilding",
  },
  running: {
    text: "text-sport-running",
    bg: "bg-sport-running",
    border: "border-sport-running",
  },
};

export const BLOCK_META: Record<
  WorkoutBlockType,
  { fa: string; en: string; text: string; bg: string; cssVar: string }
> = {
  warmup: {
    fa: "گرم کردن",
    en: "Warm-up",
    text: "text-block-warmup",
    bg: "bg-block-warmup",
    cssVar: "var(--block-warmup)",
  },
  strength: {
    fa: "قدرت / بدنسازی",
    en: "Strength",
    text: "text-block-strength",
    bg: "bg-block-strength",
    cssVar: "var(--block-strength)",
  },
  engine: {
    fa: "موتور",
    en: "Engine",
    text: "text-block-engine",
    bg: "bg-block-engine",
    cssVar: "var(--block-engine)",
  },
  wod: { fa: "WOD", en: "WOD", text: "text-block-wod", bg: "bg-block-wod", cssVar: "var(--block-wod)" },
  skill: {
    fa: "مهارت",
    en: "Skill",
    text: "text-block-skill",
    bg: "bg-block-skill",
    cssVar: "var(--block-skill)",
  },
  weightlifting: {
    fa: "وزنه‌برداری",
    en: "Weightlifting",
    text: "text-block-weightlifting",
    bg: "bg-block-weightlifting",
    cssVar: "var(--block-weightlifting)",
  },
  cooldown: {
    fa: "سرد کردن",
    en: "Cooldown",
    text: "text-block-cooldown",
    bg: "bg-block-cooldown",
    cssVar: "var(--block-cooldown)",
  },
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
  elite: "حرفه‌ای",
};
