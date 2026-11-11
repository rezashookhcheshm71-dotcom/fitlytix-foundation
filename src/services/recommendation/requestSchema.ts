/**
 * Request validation for the recommendation endpoint.
 * Shared by the API route (and any future client) so the contract cannot drift.
 */
import { z } from "zod";

const goalSchema = z.enum(["strength", "muscle", "fat_loss", "endurance", "competition", "health"]);

const answerValue = z.union([
  z.string().max(400),
  z.number(),
  z.array(z.string().max(200)).max(20),
]);

const profileSchema = z
  .object({
    age: z.number().min(12).max(85).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    heightCm: z.number().min(120).max(230).optional(),
    weightKg: z.number().min(30).max(250).optional(),
    experience: z.enum(["beginner", "intermediate", "advanced", "elite"]).optional(),
    primaryGoal: goalSchema.optional(),
    sessionsPerWeek: z.number().min(1).max(7).optional(),
    minutesPerSession: z.number().min(15).max(180).optional(),
  })
  .optional();

const behaviorSchema = z
  .object({
    windowDays: z.number().int().min(7).max(180).optional(),
    plannedSessions: z.number().min(0).max(200).optional(),
    completedSessions: z.number().min(0).max(200).optional(),
    missedSessions: z.number().min(0).max(200).optional(),
    avgRpe: z.number().min(0).max(10).optional(),
    previousAvgRpe: z.number().min(0).max(10).optional(),
    feedbackCount: z.number().min(0).max(500).optional(),
    readinessAvg: z.number().min(0).max(100).optional(),
    nutritionAdherence: z.number().min(0).max(1).optional(),
    daysSinceSignup: z.number().min(0).max(20000).optional(),
    priorPlanMonths: z.number().min(0).max(36).optional(),
    priorPlanCount: z.number().min(0).max(50).optional(),
    wearableConnected: z.boolean().optional(),
  })
  .optional();

export const recommendationRequestSchema = z.object({
  athleteId: z.string().trim().min(1).max(64).optional(),
  sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]),
  profile: profileSchema,
  assessmentAnswers: z.record(z.string().max(120), answerValue).optional(),
  bodyAnalysis: z
    .object({
      weightKg: z.number().min(30).max(250).optional(),
      heightCm: z.number().min(120).max(230).optional(),
      bodyFatPct: z.number().min(2).max(65).optional(),
      measuredAt: z.string().max(32).optional(),
    })
    .optional(),
  behavior: behaviorSchema,
  nutrition: z
    .object({
      mealsPerDay: z.number().int().min(2).max(6).optional(),
      restrictions: z.array(z.string().max(60)).max(20).optional(),
    })
    .optional(),
  constraints: z
    .object({
      durationMonths: z
        .union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal("auto")])
        .optional(),
      packageId: z.enum(["training", "nutrition", "combined"]).optional(),
      coachingPreference: z.enum(["ai", "hybrid", "human", "auto"]).optional(),
      maxSessionsPerWeek: z.number().int().min(1).max(7).optional(),
    })
    .optional(),
});

export type ValidatedRecommendationRequest = z.infer<typeof recommendationRequestSchema>;
