/**
 * Deterministic safety-first fallback.
 *
 * Used when: the artefact is missing a sport model, a class is unknown, or the
 * request is too malformed to vectorise. It is deliberately simple and boring —
 * a transparent rule of thumb is preferable to a confident wrong plan.
 */
import type { GoalId, PlanDurationMonths } from "@/domain/recommendation";
import type { SportId } from "@/domain/types";

export const LOW_IMPACT_ARCHETYPE: Record<SportId, string> = {
  crossfit: "cf_foundation",
  hyrox: "hx_hybrid_maintenance",
  functional: "fn_mobility_recovery",
  bodybuilding: "bb_full_body_foundation",
  running: "rn_base_build",
};

export const HIGH_IMPACT_ARCHETYPES = new Set([
  "cf_engine_competition",
  "hx_race_prep",
  "rn_half_marathon",
  "rn_threshold_5k10k",
  "bb_push_pull_legs",
]);

const GOAL_ARCHETYPE: Record<SportId, Partial<Record<GoalId, string>>> = {
  crossfit: {
    strength: "cf_strength_skill",
    competition: "cf_engine_competition",
    endurance: "cf_engine_competition",
    health: "cf_foundation",
  },
  hyrox: {
    competition: "hx_race_prep",
    endurance: "hx_base_engine",
    strength: "hx_station_strength",
    health: "hx_hybrid_maintenance",
  },
  functional: {
    strength: "fn_strength_balance",
    fat_loss: "fn_conditioning_gpp",
    endurance: "fn_conditioning_gpp",
    health: "fn_movement_foundation",
  },
  bodybuilding: {
    muscle: "bb_upper_lower",
    strength: "bb_upper_lower",
    fat_loss: "bb_full_body_foundation",
    competition: "bb_weak_point",
  },
  running: {
    endurance: "rn_base_build",
    competition: "rn_threshold_5k10k",
    fat_loss: "rn_speed_maintenance",
    health: "rn_base_build",
  },
};

export function fallbackArchetype(args: {
  sport: SportId;
  goal: GoalId;
  experienceRank: number;
  painSeverity: number;
}): string {
  if (args.painSeverity >= 1.6) return LOW_IMPACT_ARCHETYPE[args.sport];
  if (args.experienceRank < 0.8) return LOW_IMPACT_ARCHETYPE[args.sport];
  return GOAL_ARCHETYPE[args.sport][args.goal] ?? LOW_IMPACT_ARCHETYPE[args.sport];
}

export function fallbackDuration(args: {
  adherence: number | undefined;
  goal: GoalId;
  isNewAthlete: boolean;
}): PlanDurationMonths {
  if (args.isNewAthlete) return 1;
  if (args.adherence !== undefined && args.adherence < 0.55) return 1;
  if (args.goal === "competition") return 3;
  if (args.goal === "health") return 6;
  return 3;
}

export function fallbackNutritionStrategy(args: {
  goal: GoalId;
  bmi: number;
  bodyFatPct: number | undefined;
}): "fat_loss_deficit" | "lean_gain" | "performance_fuel" | "maintenance" | "recomp" {
  if (args.bmi < 18.5) return "lean_gain";
  if (args.goal === "fat_loss")
    return args.bodyFatPct !== undefined && args.bodyFatPct < 12 ? "recomp" : "fat_loss_deficit";
  if (args.goal === "muscle") return "lean_gain";
  if (args.goal === "competition" || args.goal === "endurance") return "performance_fuel";
  if (args.goal === "strength") return "recomp";
  return "maintenance";
}
