/** MOCK DATA — demo coach & multi-sport roster (نسخه نمایشی). TODO(backend): replace with coach service queries. */
import type { AthleteProfile, CoachAthleteSummary, CoachAssessment, CoachProfile } from "@/domain/types";
import { demoAthlete } from "./athlete";

export const demoCoach: CoachProfile = {
  id: "coach_001",
  identity: {
    id: "idn_c1",
    firstName: "سارا",
    lastName: "موسوی",
    mobile: "0935***8810",
    mobileVerified: true,
    email: "coach.demo@example.com",
    createdAt: "2025-09-01",
  },
  specialties: ["crossfit", "hyrox"],
  bio: "مربی سطح ۲ کراس‌فیت، متخصص وزنه‌برداری و برنامه‌ریزی مسابقه.",
  athleteIds: ["ath_001", "ath_002", "ath_003", "ath_004", "ath_005", "ath_006", "ath_007", "ath_008", "ath_009", "ath_010"],
};

export const demoCoachAssessment: CoachAssessment = {
  displayName: "سارا موسوی",
  title: "مربی کراس‌فیت و HYROX",
  sports: ["crossfit", "hyrox", "functional"],
  level: "head_coach",
  certifications: ["CrossFit Level 2", "USAW Level 1"],
  yearsCoaching: 7,
  style: "ساختارمند، با تمرکز روی کیفیت حرکت قبل از شدت",
  languages: ["فارسی", "English"],
  delivery: ["online", "in_person"],
  capacity: 25,
  goals: "ساخت تیم مسابقه HYROX و همراهی ورزشکارهای تازه‌کار تا سطح Rx",
  bio: "هفت سال است با ورزشکارهای کراس‌فیت و HYROX کار می‌کنم؛ از تازه‌کار تا مسابقه‌ای.",
  expertise: ["وزنه‌برداری المپیک", "pacing مسابقه", "اسکیلینگ ژیمناستیک"],
};

const mk = (
  id: string,
  first: string,
  last: string,
  gender: AthleteProfile["gender"],
  sport: AthleteProfile["primarySport"],
  exp: AthleteProfile["experience"],
  coachingType: AthleteProfile["coachingType"],
  body: [number, number, number],
): AthleteProfile => ({
  id,
  identity: { id: `idn_${id}`, firstName: first, lastName: last, mobile: "09**", mobileVerified: true, email: `${id}@example.com`, createdAt: "2025-12-01" },
  gender,
  birthYear: body[0],
  heightCm: body[1],
  weightKg: body[2],
  primarySport: sport,
  experience: exp,
  trainingAgeYears: exp === "beginner" ? 0 : exp === "intermediate" ? 2 : 5,
  goals: [],
  coachId: "coach_001",
  coachingType,
});

export const coachRoster: CoachAthleteSummary[] = [
  { athlete: demoAthlete, readiness: 78, adherence: 0.9, performanceIndex: 75, trend: 4, flag: "peak", lastSession: "دیروز", nextWorkout: "Snatch Control + WOD", goal: "Snatch ۹۰ کیلو", goalType: "performance", packageId: "combined", nutritionAdherence: 0.82, improvement: 6 },
  { athlete: mk("ath_002", "نگار", "احمدی", "female", "crossfit", "intermediate", "human", [1995, 165, 60]), readiness: 54, adherence: 0.72, performanceIndex: 58, trend: -2, flag: "attention", lastSession: "۴ روز پیش", nextWorkout: "Engine Intervals", goal: "اولین Pull-up بدون کش", goalType: "skill", packageId: "training", improvement: -2 },
  { athlete: mk("ath_003", "مهدی", "رضایی", "male", "hyrox", "advanced", "hybrid", [1990, 182, 84]), readiness: 82, adherence: 0.95, performanceIndex: 81, trend: 3, lastSession: "امروز", nextWorkout: "Sled + 1k Repeats", goal: "HYROX Pro زیر ۷۵ دقیقه", goalType: "race", packageId: "combined", nutritionAdherence: 0.9, improvement: 4 },
  { athlete: mk("ath_004", "لیلا", "نوری", "female", "functional", "beginner", "ai", [1998, 160, 58]), readiness: 70, adherence: 0.83, performanceIndex: 46, trend: 6, lastSession: "دیروز", nextWorkout: "Movement Foundations", goal: "تحرک بهتر و کمردرد کمتر", goalType: "health", packageId: "training", improvement: 9 },
  { athlete: mk("ath_005", "کیان", "صادقی", "male", "bodybuilding", "intermediate", "human", [1997, 176, 79]), readiness: 61, adherence: 0.68, performanceIndex: 63, trend: 0, flag: "recovering", lastSession: "۲ روز پیش", nextWorkout: "Upper Hypertrophy", goal: "۴ کیلو عضله در ۶ ماه", goalType: "body", packageId: "combined", nutritionAdherence: 0.55, improvement: 1 },
  { athlete: mk("ath_006", "پریسا", "جعفری", "female", "running", "advanced", "hybrid", [1993, 167, 55]), readiness: 88, adherence: 0.92, performanceIndex: 79, trend: 2, lastSession: "امروز", nextWorkout: "Tempo 8k", goal: "نیمه‌ماراتن زیر ۱:۴۵", goalType: "race", packageId: "training", improvement: 3 },
  { athlete: mk("ath_007", "امید", "حسینی", "male", "bodybuilding", "beginner", "ai", [2000, 179, 92]), readiness: 66, adherence: 0.6, performanceIndex: 38, trend: 2, flag: "attention", lastSession: "۵ روز پیش", nextWorkout: "Full Body A", goal: "کاهش چربی", goalType: "body", packageId: "nutrition", nutritionAdherence: 0.48, improvement: 2 },
  { athlete: mk("ath_008", "سمیرا", "کاظمی", "female", "hyrox", "beginner", "hybrid", [1996, 163, 64]), readiness: 74, adherence: 0.86, performanceIndex: 44, trend: 5, lastSession: "دیروز", nextWorkout: "Run + Wall Balls", goal: "اولین مسابقه HYROX", goalType: "race", packageId: "combined", nutritionAdherence: 0.78, improvement: 7 },
  { athlete: mk("ath_009", "رضا", "مرادی", "male", "running", "beginner", "ai", [1992, 175, 77]), readiness: 49, adherence: 0.77, performanceIndex: 35, trend: -1, flag: "recovering", lastSession: "۳ روز پیش", nextWorkout: "Easy 30 min", goal: "۵ کیلومتر بدون توقف", goalType: "race", packageId: "training", improvement: -1 },
  { athlete: mk("ath_010", "الهام", "شریفی", "female", "functional", "intermediate", "human", [1989, 170, 66]), readiness: 80, adherence: 0.94, performanceIndex: 62, trend: 3, lastSession: "امروز", nextWorkout: "Strength + Carry", goal: "Deadlift ۱۰۰ کیلو", goalType: "performance", packageId: "combined", nutritionAdherence: 0.88, improvement: 5 },
];

export const findRosterAthlete = (id: string) => coachRoster.find((r) => r.athlete.id === id);
