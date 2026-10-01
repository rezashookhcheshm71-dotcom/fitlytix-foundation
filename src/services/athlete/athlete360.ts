/**
 * Athlete 360 aggregate — one read model that references the same athlete identity across every domain.
 * UI reads this (or the individual services); it never reaches into mock files directly.
 * TODO(backend): assemble server-side from persisted tables; keep this shape as the API DTO.
 */
import type { AthletePassport, PackageId, SportId } from "@/domain/types";
import { demoAthlete, demoBenchmarks, demoPRs, demoSkills } from "@/mock/athlete";
import { coachRoster } from "@/mock/coach";
import { athleteDashboardService } from "./dashboard";
import { bodyAnalysisService } from "@/services/body-analysis/service";
import { goalsService } from "@/services/goals/service";
import { healthDataService } from "@/services/health-data/service";
import { nutritionService } from "@/services/nutrition/service";
import { recoveryService } from "@/services/recovery/service";
import { subscriptionService } from "@/services/subscriptions/service";

export const athlete360Service = {
  get(athleteId: string, sport: SportId, pkg?: PackageId) {
    const profile = coachRoster.find((r) => r.athlete.id === athleteId)?.athlete ?? demoAthlete;
    return {
      profile,
      sport,
      package: subscriptionService.getPackage(athleteId, pkg),
      snapshot: athleteDashboardService.getSnapshot(athleteId, sport),
      goals: goalsService.list(athleteId, sport),
      body: bodyAnalysisService.list(athleteId),
      readiness: recoveryService.assess(athleteId, sport),
      health: { connections: healthDataService.listConnections(athleteId), latest: healthDataService.latestByType(athleteId) },
      nutrition: { profile: nutritionService.getProfile(athleteId), adherence: nutritionService.adherence(athleteId) },
      performance: athleteId === demoAthlete.id ? { prs: demoPRs, benchmarks: demoBenchmarks, skills: demoSkills } : { prs: [], benchmarks: [], skills: [] },
    };
  },
  passport(athleteId: string, sport: SportId): AthletePassport {
    const a = this.get(athleteId, sport);
    const sportSpecific = sport === a.profile.primarySport;
    return {
      athleteId,
      name: `${a.profile.identity.firstName} ${a.profile.identity.lastName}`,
      sport,
      level: a.profile.experience,
      archetype: a.snapshot.dna.archetype,
      topDimensions: [...a.snapshot.dna.dimensions].sort((x, y) => y.score - x.score).slice(0, 3).map((d) => ({ label: d.label, score: d.score })),
      prs: sportSpecific ? a.performance.prs.slice(0, 4).map((p) => ({ name: p.exerciseName, value: `${p.value} ${p.unit}` })) : a.snapshot.metrics.map((m) => ({ name: m.label, value: m.value })),
      benchmarks: sportSpecific ? a.performance.benchmarks.slice(0, 3).map((b) => ({ name: b.name, result: b.result })) : [],
      skills: sportSpecific ? a.performance.skills.filter((s) => s.status !== "locked").slice(0, 5).map((s) => s.name) : [],
      goals: a.goals.map((g) => g.title),
      consistency: a.snapshot.program.adherence,
      progressNote: a.snapshot.dna.insights[0]?.text ?? "",
      shareable: false,
    };
  },
};
