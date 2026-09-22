/**
 * MOCK DATA — demo CrossFit athlete. Clearly isolated; replace with DB queries.
 * TODO(backend): remove once athlete service reads from Postgres.
 */
import type {
  AthleteProfile,
  Benchmark,
  FitnessDNA,
  PersonalRecord,
  PerformancePoint,
  RecoverySnapshot,
  Skill,
  WorkoutResult,
} from "@/domain/types";

export const demoAthlete: AthleteProfile = {
  id: "ath_001",
  identity: {
    id: "idn_001",
    firstName: "آرش",
    lastName: "کریمی",
    mobile: "0912***4471",
    mobileVerified: true,
    email: "arash@example.com",
    createdAt: "2025-11-02",
  },
  gender: "male",
  birthYear: 1996,
  heightCm: 178,
  weightKg: 81,
  primarySport: "crossfit",
  experience: "advanced",
  trainingAgeYears: 4,
  coachId: "coach_001",
  coachingType: "hybrid",
  goals: [
    { id: "g1", title: "Snatch ۹۰ کیلو", metric: "Snatch 1RM", target: "90 kg", deadline: "1405/03", progress: 0.72 },
    { id: "g2", title: "Fran زیر ۴ دقیقه", metric: "Fran", target: "3:59", deadline: "1405/02", progress: 0.55 },
    { id: "g3", title: "Ring Muscle-up پیوسته ×۵", metric: "RMU", target: "5 UB", progress: 0.4 },
  ],
};

export const demoDNA: FitnessDNA = {
  athleteId: "ath_001",
  generatedAt: "1404/06/28",
  archetype: "موتور قدرتی",
  archetypeEn: "Power Engine",
  summary:
    "پروفایل تو ترکیبی از قدرت پایه بالا و موتور رو به رشد است. ژیمناستیک و ثبات بالای سر بزرگ‌ترین محدودکننده‌های امتیاز کلی هستند.",
  dimensions: [
    { id: "strength", label: "قدرت", labelEn: "Strength", score: 82, percentile: 88, trend: 3, insight: "Back Squat در صدک ۸۸ هم‌رده‌ها" },
    { id: "power", label: "توان", labelEn: "Power", score: 76, percentile: 80, trend: 5, insight: "Clean & Jerk رشد پایدار" },
    { id: "engine", label: "موتور", labelEn: "Engine", score: 68, percentile: 64, trend: 6, insight: "Row 2k بهبود ۱۱ ثانیه‌ای" },
    { id: "gymnastics", label: "ژیمناستیک", labelEn: "Gymnastics", score: 54, percentile: 46, trend: 2, insight: "RMU هنوز ناپایدار" },
    { id: "mobility", label: "تحرک", labelEn: "Mobility", score: 58, percentile: 50, trend: -1, insight: "محدودیت شانه در OHS" },
    { id: "recovery", label: "ریکاوری", labelEn: "Recovery", score: 71, percentile: 70, trend: 4, insight: "کیفیت خواب رو به بهبود" },
    { id: "consistency", label: "استمرار", labelEn: "Consistency", score: 90, percentile: 94, trend: 1, insight: "۹۰٪ پایبندی در ۸ هفته" },
    { id: "skill", label: "مهارت", labelEn: "Skill", score: 61, percentile: 58, trend: 3, insight: "DU پایدار، HS Walk در حال یادگیری" },
  ],
  limiters: ["ژیمناستیک حلقه", "تحرک شانه", "پیس‌گذاری در WOD بلند"],
  strengths: ["قدرت پایین‌تنه", "استمرار تمرین", "توان انفجاری"],
  source: "mock",
};

export const demoSkills: Skill[] = [
  { id: "s1", name: "Double Under", category: "gymnastics", status: "mastered", progress: 1, nextMilestone: "۱۰۰ پیوسته" },
  { id: "s2", name: "Bar Muscle-up", category: "gymnastics", status: "consistent", progress: 0.8, nextMilestone: "۷ پیوسته" },
  { id: "s3", name: "Ring Muscle-up", category: "gymnastics", status: "learning", progress: 0.4, nextMilestone: "۳ پیوسته" },
  { id: "s4", name: "Handstand Walk", category: "gymnastics", status: "learning", progress: 0.35, nextMilestone: "۱۵ متر" },
  { id: "s5", name: "Squat Snatch", category: "weightlifting", status: "consistent", progress: 0.72, nextMilestone: "۹۰ کیلو" },
  { id: "s6", name: "Strict HSPU", category: "gymnastics", status: "consistent", progress: 0.65, nextMilestone: "۱۰ پیوسته" },
  { id: "s7", name: "Pistol Squat", category: "mobility", status: "mastered", progress: 1 },
  { id: "s8", name: "Butterfly Pull-up", category: "gymnastics", status: "locked", progress: 0.1, nextMilestone: "شروع پس از C2B ×۱۵" },
];

export const demoPRs: PersonalRecord[] = [
  { id: "pr1", exerciseId: "ex_bs", exerciseName: "Back Squat", value: 165, unit: "kg", date: "1404/06/12", previous: 160 },
  { id: "pr2", exerciseId: "ex_dl", exerciseName: "Deadlift", value: 200, unit: "kg", date: "1404/05/20", previous: 190 },
  { id: "pr3", exerciseId: "ex_cj", exerciseName: "Clean & Jerk", value: 112, unit: "kg", date: "1404/06/25", previous: 108 },
  { id: "pr4", exerciseId: "ex_sn", exerciseName: "Snatch", value: 85, unit: "kg", date: "1404/06/05", previous: 82 },
  { id: "pr5", exerciseId: "ex_sp", exerciseName: "Strict Press", value: 68, unit: "kg", date: "1404/04/30", previous: 65 },
  { id: "pr6", exerciseId: "ex_row", exerciseName: "Row 2k", value: 431, unit: "sec", date: "1404/06/18", previous: 442 },
];

export const demoBenchmarks: Benchmark[] = [
  { id: "b1", name: "Fran", type: "for_time", result: "4:38", date: "1404/06/20", rxOrScaled: "rx", delta: "-0:22" },
  { id: "b2", name: "Grace", type: "for_time", result: "3:05", date: "1404/05/28", rxOrScaled: "rx", delta: "-0:14" },
  { id: "b3", name: "Cindy", type: "amrap", result: "21 + 9", date: "1404/05/10", rxOrScaled: "rx", delta: "+2 rds" },
  { id: "b4", name: "Murph", type: "for_time", result: "44:12", date: "1404/03/15", rxOrScaled: "rx", delta: "-3:40" },
  { id: "b5", name: "CrossFit Total", type: "max_load", result: "433 kg", date: "1404/06/12", rxOrScaled: "rx", delta: "+15 kg" },
];

export const demoRecovery: RecoverySnapshot = {
  date: "1404/06/31",
  readiness: 78,
  sleepHours: 7.4,
  sleepQuality: 82,
  hrv: 64,
  restingHr: 52,
  soreness: 35,
  strain: 12.4,
  recommendation: "آماده برای جلسه با شدت متوسط تا بالا. حجم وزنه‌برداری را ۱۰٪ کم کن.",
};

export const demoPerformance: PerformancePoint[] = [
  { week: "W1", performanceIndex: 61, strength: 74, engine: 55, volume: 18 },
  { week: "W2", performanceIndex: 63, strength: 75, engine: 57, volume: 20 },
  { week: "W3", performanceIndex: 62, strength: 76, engine: 56, volume: 22 },
  { week: "W4", performanceIndex: 66, strength: 77, engine: 60, volume: 19 },
  { week: "W5", performanceIndex: 69, strength: 79, engine: 63, volume: 23 },
  { week: "W6", performanceIndex: 70, strength: 80, engine: 64, volume: 24 },
  { week: "W7", performanceIndex: 73, strength: 81, engine: 67, volume: 22 },
  { week: "W8", performanceIndex: 75, strength: 82, engine: 68, volume: 25 },
];

export const demoSessions: WorkoutResult[] = [
  { id: "r1", workoutId: "w_d3", date: "1404/06/30", title: "Engine + Snatch Complex", score: "12:44", rpe: 8, durationMin: 68, blocksCompleted: 6, totalBlocks: 6 },
  { id: "r2", workoutId: "w_d2", date: "1404/06/29", title: "Back Squat 5×3 + Fran", score: "4:38 Rx", rpe: 9, durationMin: 74, blocksCompleted: 6, totalBlocks: 6, prAchieved: true },
  { id: "r3", workoutId: "w_d1", date: "1404/06/27", title: "Gymnastics Skill + AMRAP 20", score: "8 + 14", rpe: 7, durationMin: 62, blocksCompleted: 5, totalBlocks: 6 },
  { id: "r4", workoutId: "w_d0", date: "1404/06/26", title: "Active Recovery Row", score: "6.2 km", rpe: 4, durationMin: 40, blocksCompleted: 3, totalBlocks: 3 },
];

export const demoRecoveryHistory = [
  { day: "ش", readiness: 62, sleep: 6.1 },
  { day: "ی", readiness: 70, sleep: 7.0 },
  { day: "د", readiness: 74, sleep: 7.2 },
  { day: "س", readiness: 66, sleep: 6.4 },
  { day: "چ", readiness: 72, sleep: 7.5 },
  { day: "پ", readiness: 80, sleep: 8.0 },
  { day: "ج", readiness: 78, sleep: 7.4 },
];
