import type { Exercise, SportId } from "./types";

export type ExerciseEducation = Pick<
  Exercise,
  | "id"
  | "name"
  | "nameFa"
  | "shortDescription"
  | "howToSteps"
  | "coachingCues"
  | "commonMistakes"
  | "breathingCue"
  | "easierOption"
  | "harderOption"
  | "equipment"
  | "difficulty"
  | "primaryMuscles"
  | "pattern"
  | "safetyNote"
  | "media"
  | "scalingOptions"
  | "sports"
>;

export const exerciseContextLabel: Record<SportId, string> = {
  crossfit: "در اجرای WOD، اول فرم درست را نگه دار و بعد سرعت را بالا ببر.",
  bodybuilding: "دامنه حرکت، کنترل وزنه و درگیری عضله هدف از سنگین‌تر کردن مهم‌تر است.",
  hyrox: "ریتمی انتخاب کن که بعد از ایستگاه بتوانی دوباره بدوی.",
  functional: "حرکت روان و متقارن را مقدم بر وزن یا سرعت بدان.",
  running: "در دریل‌های دویدن، کیفیت گام مهم‌تر از تعداد تکرار است.",
};
