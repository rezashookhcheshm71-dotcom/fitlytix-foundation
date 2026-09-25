import type { BodyAnalysisRecord } from "@/domain/body-analysis";

/** Demo measurements for ath_001 — isolated mock seed, read only through bodyAnalysisService. */
export const DEMO_BODY_RECORDS: BodyAnalysisRecord[] = [
  { id: "ba_001", athleteId: "ath_001", version: 1, measuredAt: "2026-06-30", source: "inbody", device: { vendor: "InBody", model: "570" }, heightCm: 178, weightKg: 81.2, bodyFatPct: 17.8, fatMassKg: 14.5, ffmKg: 66.7, skeletalMuscleKg: 37.6, bmi: 25.6, visceralFat: 7, bodyWaterPct: 60.1, bmrKcal: 1810, createdAt: "2026-06-30T09:00:00Z" },
  { id: "ba_002", athleteId: "ath_001", version: 1, measuredAt: "2026-07-28", source: "inbody", device: { vendor: "InBody", model: "570" }, heightCm: 178, weightKg: 80.9, bodyFatPct: 16.9, fatMassKg: 13.7, ffmKg: 67.2, skeletalMuscleKg: 37.9, bmi: 25.5, visceralFat: 7, bodyWaterPct: 60.6, bmrKcal: 1822, createdAt: "2026-07-28T09:00:00Z" },
  { id: "ba_003", athleteId: "ath_001", version: 1, measuredAt: "2026-08-25", source: "manual", heightCm: 178, weightKg: 81.4, bodyFatPct: 16.2, skeletalMuscleKg: 38.3, createdAt: "2026-08-25T09:00:00Z" },
  { id: "ba_004", athleteId: "ath_001", version: 1, measuredAt: "2026-09-22", source: "inbody", device: { vendor: "InBody", model: "570" }, heightCm: 178, weightKg: 81.0, bodyFatPct: 15.4, fatMassKg: 12.5, ffmKg: 68.5, skeletalMuscleKg: 38.7, bmi: 25.6, visceralFat: 6, bodyWaterPct: 61.2, bmrKcal: 1850, segmental: { rightArm: { leanKg: 3.9 }, leftArm: { leanKg: 3.8 }, trunk: { leanKg: 30.1 }, rightLeg: { leanKg: 10.4 }, leftLeg: { leanKg: 10.2 } }, createdAt: "2026-09-22T09:00:00Z" },
];
