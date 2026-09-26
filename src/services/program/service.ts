import type { ExperienceLevel, Program, SportId, Workout } from "@/domain/types";
import { demoProgram, todayWorkout } from "@/mock/program";

const sportSessions: Partial<Record<SportId, Workout>> = {
  bodybuilding: {
    id: "w_bb_1", programId: "prg_bb", dayIndex: 1, date: "1404/07/04", title: "سینه و پشت بازو", focus: "کنترل حرکت و حجم عضله سینه", estimatedMin: 58, status: "today",
    blocks: [
      { id: "bb1", type: "warmup", title: "آماده‌سازی شانه", titleEn: "Warm-up", durationMin: 8, intent: "گرم شدن مفصل شانه و فعال شدن کتف", movements: [{ exerciseId: "ex_banded_pull_apart", exerciseName: "Banded Pull-apart", scheme: "2×15" }] },
      { id: "bb2", type: "strength", title: "حرکت اصلی", titleEn: "Primary lift", durationMin: 20, intent: "فشار قوی با دامنه کامل و کنترل وزنه", targetRpe: 7, movements: [{ exerciseId: "ex_db_press", exerciseName: "Dumbbell Bench Press", scheme: "3×8", load: "وزنه‌ای که ۳ تکرار ذخیره بماند", notes: "tempo 3110", scaling: "Chest Press دستگاه" }] },
      { id: "bb3", type: "skill", title: "حجم و عضله‌سازی", titleEn: "Hypertrophy", durationMin: 22, intent: "حفظ تنش روی عضله، نه جابه‌جایی صرف وزنه", movements: [{ exerciseId: "ex_db_press", exerciseName: "Incline Dumbbell Press", scheme: "3×12", load: "سبک تا متوسط", scaling: "Incline Push-up" }] },
      { id: "bb4", type: "cooldown", title: "سرد کردن", titleEn: "Cooldown", durationMin: 8, intent: "برگشت ضربان و آزاد کردن شانه", movements: [{ exerciseName: "تنفس و کشش سینه", scheme: "5 min" }] },
    ],
  },
  running: {
    id: "w_run_1", programId: "prg_run", dayIndex: 1, date: "1404/07/04", title: "دویدن آرام + دریل", focus: "ریتم راحت و فرم سبک", estimatedMin: 46, status: "today",
    blocks: [
      { id: "run1", type: "warmup", title: "گرم کردن و دریل", titleEn: "Warm-up & drills", durationMin: 10, intent: "آماده شدن مچ، ساق و لگن", movements: [{ exerciseName: "راه رفتن و چرخش مفاصل", scheme: "5 min" }, { exerciseName: "A-Skip", scheme: "3×20 m", scaling: "راه رفتن زانو بلند" }] },
      { id: "run2", type: "engine", title: "دویدن آرام", titleEn: "Easy run", durationMin: 28, intent: "ساخت پایه هوازی بدون فشار اضافه", targetRpe: 4, movements: [{ exerciseId: "ex_easy_run", exerciseName: "Easy Run", scheme: "28 min", load: "ریتم قابل گفتگو", scaling: "2 min run / 1 min walk" }] },
      { id: "run3", type: "strength", title: "قدرت مکمل", titleEn: "Strength accessory", durationMin: 4, intent: "ثبات تک‌پا برای گام بهتر", movements: [{ exerciseId: "ex_bss", exerciseName: "Split Squat", scheme: "2×8/leg", scaling: "با تکیه به دیوار" }] },
      { id: "run4", type: "cooldown", title: "آرام کردن", titleEn: "Cooldown", durationMin: 4, intent: "پایین آوردن تدریجی ضربان", movements: [{ exerciseName: "راه رفتن آرام", scheme: "4 min" }] },
    ],
  },
};

export interface WorkoutPresentation {
  sport: SportId;
  experience: ExperienceLevel;
  program: Program;
  workout: Workout;
}

export const programDisplayService = {
  getToday(sport: SportId, experience: ExperienceLevel): WorkoutPresentation {
    return { sport, experience, program: demoProgram, workout: sportSessions[sport] ?? todayWorkout };
  },
};
