import type { ExperienceLevel, Program, SportId, Workout } from "@/domain/types";
import { demoProgram, todayWorkout } from "@/mock/program";

const sportSessions: Partial<Record<SportId, Workout>> = {
  hyrox: {
    id: "w_hy_1",
    programId: "prg_hy",
    dayIndex: 1,
    date: "1404/07/04",
    title: "دویدن و ایستگاه‌ها",
    focus: "حفظ ریتم میان دویدن و ایستگاه",
    estimatedMin: 54,
    status: "today",
    blocks: [
      {
        id: "hy1",
        type: "warmup",
        title: "گرم کردن",
        titleEn: "Warm-up",
        durationMin: 8,
        intent: "آماده کردن پاها و تنفس",
        movements: [{ exerciseId: "ex_easy_run", exerciseName: "Easy Run", scheme: "5 min easy" }],
      },
      {
        id: "hy2",
        type: "engine",
        title: "دویدن و موتور",
        titleEn: "Run & engine",
        durationMin: 15,
        intent: "پیدا کردن سرعت پایدار",
        movements: [
          { exerciseId: "ex_easy_run", exerciseName: "Easy Run", scheme: "10 min" },
          { exerciseId: "ex_row", exerciseName: "Row", scheme: "5 min" },
        ],
      },
      {
        id: "hy3",
        type: "strength",
        title: "ایستگاه‌ها",
        titleEn: "Stations",
        durationMin: 12,
        intent: "حرکت کنترل‌شده بعد از دویدن",
        movements: [{ exerciseName: "Sled Push", scheme: "4×20 m", scaling: "سورتمه سبک‌تر" }],
      },
      {
        id: "hy4",
        type: "skill",
        title: "استقامت قدرتی و ریتم مسابقه",
        titleEn: "Race pace",
        durationMin: 14,
        intent: "پیوستگی در تکرارهای طولانی",
        movements: [{ exerciseName: "Farmer Carry", scheme: "4×40 m", scaling: "وزنه سبک‌تر" }],
      },
      {
        id: "hy5",
        type: "cooldown",
        title: "سرد کردن",
        titleEn: "Cooldown",
        durationMin: 5,
        intent: "پایین آوردن ضربان",
        movements: [{ exerciseName: "راه رفتن آرام", scheme: "5 min" }],
      },
    ],
  },
  functional: {
    id: "w_fn_1",
    programId: "prg_fn",
    dayIndex: 1,
    date: "1404/07/04",
    title: "حرکت و قدرت پایه",
    focus: "کیفیت حرکت و تعادل",
    estimatedMin: 48,
    status: "today",
    blocks: [
      {
        id: "fn1",
        type: "warmup",
        title: "گرم کردن",
        titleEn: "Warm-up",
        durationMin: 8,
        intent: "آماده شدن مفصل‌ها",
        movements: [{ exerciseName: "راه رفتن و چرخش مفاصل", scheme: "8 min" }],
      },
      {
        id: "fn2",
        type: "skill",
        title: "حرکت و موبیلیتی",
        titleEn: "Movement",
        durationMin: 10,
        intent: "دامنه حرکت آرام و بدون فشار",
        movements: [
          {
            exerciseId: "ex_goblet_squat",
            exerciseName: "Goblet Squat + Pause",
            scheme: "2×8",
            scaling: "اسکوات روی نیمکت",
          },
        ],
      },
      {
        id: "fn3",
        type: "strength",
        title: "قدرت",
        titleEn: "Strength",
        durationMin: 15,
        intent: "ساخت قدرت پایدار در پاها",
        movements: [
          {
            exerciseId: "ex_bss",
            exerciseName: "Bulgarian Split Squat",
            scheme: "3×8/leg",
            scaling: "Split Squat روی زمین",
          },
        ],
      },
      {
        id: "fn4",
        type: "engine",
        title: "آمادگی هوازی و تعادل",
        titleEn: "Conditioning",
        durationMin: 10,
        intent: "بالا بردن ضربان با کنترل بدن",
        movements: [
          { exerciseId: "ex_row", exerciseName: "Row", scheme: "5 min easy" },
          { exerciseName: "تعادل تک‌پا", scheme: "2×30 sec" },
        ],
      },
      {
        id: "fn5",
        type: "cooldown",
        title: "سرد کردن",
        titleEn: "Cooldown",
        durationMin: 5,
        intent: "برگشت به ریتم آرام",
        movements: [{ exerciseName: "تنفس آرام", scheme: "5 min" }],
      },
    ],
  },
  bodybuilding: {
    id: "w_bb_1",
    programId: "prg_bb",
    dayIndex: 1,
    date: "1404/07/04",
    title: "سینه و پشت بازو",
    focus: "کنترل حرکت و حجم عضله سینه",
    estimatedMin: 58,
    status: "today",
    blocks: [
      {
        id: "bb1",
        type: "warmup",
        title: "آماده‌سازی شانه",
        titleEn: "Warm-up",
        durationMin: 8,
        intent: "گرم شدن مفصل شانه و فعال شدن کتف",
        movements: [
          { exerciseId: "ex_banded_pull_apart", exerciseName: "Banded Pull-apart", scheme: "2×15" },
        ],
      },
      {
        id: "bb2",
        type: "strength",
        title: "حرکت اصلی",
        titleEn: "Primary lift",
        durationMin: 20,
        intent: "فشار قوی با دامنه کامل و کنترل وزنه",
        targetRpe: 7,
        movements: [
          {
            exerciseId: "ex_db_press",
            exerciseName: "Dumbbell Bench Press",
            scheme: "3×8",
            load: "وزنه‌ای که ۳ تکرار ذخیره بماند",
            notes: "tempo 3110",
            scaling: "Chest Press دستگاه",
          },
        ],
      },
      {
        id: "bb3",
        type: "skill",
        title: "حجم و عضله‌سازی",
        titleEn: "Hypertrophy",
        durationMin: 22,
        intent: "حفظ تنش روی عضله، نه جابه‌جایی صرف وزنه",
        movements: [
          {
            exerciseId: "ex_db_press",
            exerciseName: "Incline Dumbbell Press",
            scheme: "3×12",
            load: "سبک تا متوسط",
            scaling: "Incline Push-up",
          },
        ],
      },
      {
        id: "bb4",
        type: "cooldown",
        title: "سرد کردن",
        titleEn: "Cooldown",
        durationMin: 8,
        intent: "برگشت ضربان و آزاد کردن شانه",
        movements: [{ exerciseName: "تنفس و کشش سینه", scheme: "5 min" }],
      },
    ],
  },
  running: {
    id: "w_run_1",
    programId: "prg_run",
    dayIndex: 1,
    date: "1404/07/04",
    title: "دویدن آرام + دریل",
    focus: "ریتم راحت و فرم سبک",
    estimatedMin: 46,
    status: "today",
    blocks: [
      {
        id: "run1",
        type: "warmup",
        title: "گرم کردن و دریل",
        titleEn: "Warm-up & drills",
        durationMin: 10,
        intent: "آماده شدن مچ، ساق و لگن",
        movements: [
          { exerciseName: "راه رفتن و چرخش مفاصل", scheme: "5 min" },
          { exerciseName: "A-Skip", scheme: "3×20 m", scaling: "راه رفتن زانو بلند" },
        ],
      },
      {
        id: "run2",
        type: "engine",
        title: "دویدن آرام",
        titleEn: "Easy run",
        durationMin: 28,
        intent: "ساخت پایه هوازی بدون فشار اضافه",
        targetRpe: 4,
        movements: [
          {
            exerciseId: "ex_easy_run",
            exerciseName: "Easy Run",
            scheme: "28 min",
            load: "ریتم قابل گفتگو",
            scaling: "2 min run / 1 min walk",
          },
        ],
      },
      {
        id: "run3",
        type: "strength",
        title: "قدرت مکمل",
        titleEn: "Strength accessory",
        durationMin: 4,
        intent: "ثبات تک‌پا برای گام بهتر",
        movements: [
          {
            exerciseId: "ex_bss",
            exerciseName: "Split Squat",
            scheme: "2×8/leg",
            scaling: "با تکیه به دیوار",
          },
        ],
      },
      {
        id: "run4",
        type: "cooldown",
        title: "آرام کردن",
        titleEn: "Cooldown",
        durationMin: 4,
        intent: "پایین آوردن تدریجی ضربان",
        movements: [{ exerciseName: "راه رفتن آرام", scheme: "4 min" }],
      },
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
    return {
      sport,
      experience,
      program: demoProgram,
      workout: sportSessions[sport] ?? todayWorkout,
    };
  },
};
