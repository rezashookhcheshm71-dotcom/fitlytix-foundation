/**
 * Body Analysis domain — shared by every sport (never sport-specific fields).
 * Records are append-only and dated so changes across measurements stay traceable.
 * TODO(backend): map to a `body_analysis_records` table (one row per measurement, JSONB for segmental/device).
 */
import { z } from "zod";

export type BodyAnalysisSource = "inbody" | "manual" | "other";
export type BodySegment = "rightArm" | "leftArm" | "trunk" | "rightLeg" | "leftLeg";

export interface SegmentalValue {
  leanKg?: number;
  fatPct?: number;
}

export interface BodyAnalysisDevice {
  /** Free-form so new devices/providers need no schema change. */
  vendor?: string;
  model?: string;
  location?: string;
}

export interface BodyAnalysisRecord {
  id: string;
  athleteId: string;
  version: 1;
  measuredAt: string; // ISO date (yyyy-mm-dd)
  source: BodyAnalysisSource;
  device?: BodyAnalysisDevice;
  heightCm?: number;
  weightKg: number;
  bodyFatPct?: number;
  fatMassKg?: number;
  ffmKg?: number;
  skeletalMuscleKg?: number;
  bmi?: number;
  visceralFat?: number;
  bodyWaterPct?: number;
  bmrKcal?: number;
  segmental?: Partial<Record<BodySegment, SegmentalValue>>;
  notes?: string;
  createdAt: string;
}

export type BodyMetricKey = "weightKg" | "bodyFatPct" | "skeletalMuscleKg";

export const BODY_SEGMENTS: { id: BodySegment; label: string }[] = [
  { id: "rightArm", label: "دست راست" },
  { id: "leftArm", label: "دست چپ" },
  { id: "trunk", label: "تنه" },
  { id: "rightLeg", label: "پای راست" },
  { id: "leftLeg", label: "پای چپ" },
];

type NumericKey = "heightCm" | "weightKg" | "bodyFatPct" | "fatMassKg" | "ffmKg" | "skeletalMuscleKg" | "bmi" | "visceralFat" | "bodyWaterPct" | "bmrKcal";

export interface BodyFieldDef {
  id: NumericKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  level: "basic" | "detail";
  hint?: string;
}

/** Wide, plausible ranges: catch typos, never reject real athletes. */
export const BODY_FIELDS: BodyFieldDef[] = [
  { id: "weightKg", label: "وزن", unit: "kg", min: 25, max: 350, level: "basic" },
  { id: "heightCm", label: "قد", unit: "cm", min: 100, max: 250, level: "basic" },
  { id: "bodyFatPct", label: "درصد چربی", unit: "%", min: 2, max: 75, level: "basic", hint: "اگر برگه‌ات دارد" },
  { id: "skeletalMuscleKg", label: "توده عضلانی (SMM)", unit: "kg", min: 5, max: 150, level: "basic", hint: "اگر برگه‌ات دارد" },
  { id: "fatMassKg", label: "توده چربی (Fat Mass)", unit: "kg", min: 0.5, max: 250, level: "detail" },
  { id: "ffmKg", label: "توده بدون چربی (FFM)", unit: "kg", min: 15, max: 200, level: "detail" },
  { id: "bmi", label: "BMI", unit: "kg/m²", min: 10, max: 80, level: "detail" },
  { id: "visceralFat", label: "چربی احشایی (Visceral)", unit: "سطح", min: 1, max: 30, level: "detail" },
  { id: "bodyWaterPct", label: "آب بدن", unit: "%", min: 30, max: 80, level: "detail" },
  { id: "bmrKcal", label: "BMR", unit: "kcal", min: 600, max: 5000, level: "detail" },
];

const rangeNum = (min: number, max: number, label: string) =>
  z.number({ invalid_type_error: `${label} باید عدد باشد` }).min(min, `${label} خیلی کم به نظر می‌رسد`).max(max, `${label} خیلی زیاد به نظر می‌رسد`).optional();

const segmentSchema = z.object({ leanKg: z.number().min(0.3).max(80).optional(), fatPct: z.number().min(1).max(75).optional() });

export const bodyAnalysisInputSchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را کامل وارد کن").refine((d) => new Date(d).getTime() <= Date.now() + 86_400_000, "تاریخ نمی‌تواند در آینده باشد"),
  source: z.enum(["inbody", "manual", "other"]),
  device: z.object({ vendor: z.string().max(60).optional(), model: z.string().max(60).optional(), location: z.string().max(80).optional() }).optional(),
  weightKg: z.number({ required_error: "وزن را وارد کن", invalid_type_error: "وزن را وارد کن" }).min(25, "وزن خیلی کم به نظر می‌رسد").max(350, "وزن خیلی زیاد به نظر می‌رسد"),
  heightCm: rangeNum(100, 250, "قد"),
  bodyFatPct: rangeNum(2, 75, "درصد چربی"),
  fatMassKg: rangeNum(0.5, 250, "توده چربی"),
  ffmKg: rangeNum(15, 200, "FFM"),
  skeletalMuscleKg: rangeNum(5, 150, "توده عضلانی"),
  bmi: rangeNum(10, 80, "BMI"),
  visceralFat: rangeNum(1, 30, "چربی احشایی"),
  bodyWaterPct: rangeNum(30, 80, "آب بدن"),
  bmrKcal: rangeNum(600, 5000, "BMR"),
  segmental: z.record(z.enum(["rightArm", "leftArm", "trunk", "rightLeg", "leftLeg"]), segmentSchema).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type BodyAnalysisInput = z.infer<typeof bodyAnalysisInputSchema>;
