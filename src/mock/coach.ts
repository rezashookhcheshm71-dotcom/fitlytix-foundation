/** MOCK DATA — demo coach & roster. TODO(backend): replace with coach service. */
import type { AthleteProfile, CoachAthleteSummary, CoachProfile } from "@/domain/types";
import { demoAthlete } from "./athlete";

export const demoCoach: CoachProfile = {
  id: "coach_001",
  identity: {
    id: "idn_c1",
    firstName: "سارا",
    lastName: "موسوی",
    mobile: "0935***8810",
    mobileVerified: true,
    email: "sara@fitlytix.app",
    createdAt: "2025-09-01",
  },
  specialties: ["crossfit", "hyrox"],
  bio: "مربی سطح ۲ کراس‌فیت، متخصص وزنه‌برداری و برنامه‌ریزی مسابقه.",
  athleteIds: ["ath_001", "ath_002", "ath_003", "ath_004", "ath_005", "ath_006"],
};

const mk = (
  id: string,
  first: string,
  last: string,
  sport: AthleteProfile["primarySport"],
  exp: AthleteProfile["experience"],
  coachingType: AthleteProfile["coachingType"],
): AthleteProfile => ({
  id,
  identity: {
    id: `idn_${id}`,
    firstName: first,
    lastName: last,
    mobile: "09**",
    mobileVerified: true,
    email: `${id}@example.com`,
    createdAt: "2025-12-01",
  },
  gender: "female",
  birthYear: 1994,
  heightCm: 168,
  weightKg: 62,
  primarySport: sport,
  experience: exp,
  trainingAgeYears: 2,
  goals: [],
  coachId: "coach_001",
  coachingType,
});

export const coachRoster: CoachAthleteSummary[] = [
  {
    athlete: demoAthlete,
    readiness: 78,
    adherence: 0.9,
    performanceIndex: 75,
    trend: 4,
    flag: "peak",
    lastSession: "دیروز",
    nextWorkout: "Strength Day — Squat & Engine",
  },
  {
    athlete: mk("ath_002", "نگار", "احمدی", "crossfit", "intermediate", "human"),
    readiness: 54,
    adherence: 0.72,
    performanceIndex: 58,
    trend: -2,
    flag: "attention",
    lastSession: "۴ روز پیش",
    nextWorkout: "Engine Intervals",
  },
  {
    athlete: mk("ath_003", "مهدی", "رضایی", "hyrox", "advanced", "hybrid"),
    readiness: 82,
    adherence: 0.95,
    performanceIndex: 81,
    trend: 3,
    lastSession: "امروز",
    nextWorkout: "Sled + 1k Repeats",
  },
  {
    athlete: mk("ath_004", "لیلا", "نوری", "functional", "beginner", "ai"),
    readiness: 70,
    adherence: 0.83,
    performanceIndex: 46,
    trend: 6,
    lastSession: "دیروز",
    nextWorkout: "Movement Foundations",
  },
  {
    athlete: mk("ath_005", "کیان", "صادقی", "bodybuilding", "intermediate", "human"),
    readiness: 61,
    adherence: 0.68,
    performanceIndex: 63,
    trend: 0,
    flag: "recovering",
    lastSession: "۲ روز پیش",
    nextWorkout: "Upper Hypertrophy",
  },
  {
    athlete: mk("ath_006", "پریسا", "جعفری", "running", "advanced", "hybrid"),
    readiness: 88,
    adherence: 0.92,
    performanceIndex: 79,
    trend: 2,
    lastSession: "امروز",
    nextWorkout: "Tempo 8k",
  },
];

export const findRosterAthlete = (id: string) => coachRoster.find((r) => r.athlete.id === id);
