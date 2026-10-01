/**
 * Coach service — profile (editable, in-memory), roster filters/segments, attention list and weekly brief.
 * Segments use transparent metrics; there is deliberately no single "best athlete" score.
 * TODO(backend): coach_profiles, coach_athletes and aggregate views with RLS scoped to the coach.
 */
import type { CoachAssessment, CoachAthleteSummary, CoachAttentionItem, SportId, WeeklyCoachBrief } from "@/domain/types";
import { coachRoster, demoCoachAssessment } from "@/mock/coach";

let profile: CoachAssessment = { ...demoCoachAssessment };
const fullName = (r: CoachAthleteSummary) => `${r.athlete.identity.firstName} ${r.athlete.identity.lastName}`;

export interface RosterFilter {
  sport?: SportId | undefined;
  level?: string | undefined;
  goalType?: string | undefined;
  attentionOnly?: boolean | undefined;
}
export type RosterSegment = "all" | "by_sport" | "by_level" | "most_improved" | "most_consistent" | "by_goal";

export const coachService = {
  getProfile: () => profile,
  updateProfile(patch: Partial<CoachAssessment>) {
    profile = { ...profile, ...patch };
    return profile;
  },
  roster(filter: RosterFilter = {}) {
    return coachRoster.filter((r) =>
      (!filter.sport || r.athlete.primarySport === filter.sport) &&
      (!filter.level || r.athlete.experience === filter.level) &&
      (!filter.goalType || r.goalType === filter.goalType) &&
      (!filter.attentionOnly || r.flag === "attention" || r.readiness < 55));
  },
  sort(list: CoachAthleteSummary[], segment: RosterSegment) {
    const l = [...list];
    if (segment === "most_improved") return l.sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0));
    if (segment === "most_consistent") return l.sort((a, b) => b.adherence - a.adherence);
    if (segment === "by_sport") return l.sort((a, b) => a.athlete.primarySport.localeCompare(b.athlete.primarySport));
    if (segment === "by_level") return l.sort((a, b) => a.athlete.experience.localeCompare(b.athlete.experience));
    if (segment === "by_goal") return l.sort((a, b) => (a.goalType ?? "").localeCompare(b.goalType ?? ""));
    return l.sort((a, b) => (a.flag === "attention" ? -1 : b.flag === "attention" ? 1 : 0));
  },
  attention(): CoachAttentionItem[] {
    const items: CoachAttentionItem[] = [];
    for (const r of coachRoster) {
      const name = fullName(r);
      if (r.readiness < 55) items.push({ id: `${r.athlete.id}_ready`, athleteId: r.athlete.id, athleteName: name, reason: "low_readiness", detail: `آمادگی ${r.readiness} — پایین‌تر از محدوده معمول`, severity: "act", suggestedAction: "شدت جلسه بعدی را کم کن و درباره خواب بپرس." });
      if (r.adherence < 0.75) items.push({ id: `${r.athlete.id}_adh`, athleteId: r.athlete.id, athleteName: name, reason: "adherence_drop", detail: `پایبندی ${Math.round(r.adherence * 100)}٪ · آخرین جلسه ${r.lastSession}`, severity: r.adherence < 0.65 ? "act" : "watch", suggestedAction: "یک پیام کوتاه بفرست و تعداد جلسه‌ها را واقع‌بینانه کن." });
      if (r.nutritionAdherence !== undefined && r.nutritionAdherence < 0.6) items.push({ id: `${r.athlete.id}_nut`, athleteId: r.athlete.id, athleteName: name, reason: "nutrition_flag", detail: `پایبندی تغذیه ${Math.round(r.nutritionAdherence * 100)}٪`, severity: "watch", suggestedAction: "وعده‌ها را ساده‌تر کن؛ تعداد وعده را با برنامه روزانه‌اش هماهنگ کن." });
      if (r.trend < 0) items.push({ id: `${r.athlete.id}_perf`, athleteId: r.athlete.id, athleteName: name, reason: "performance_drop", detail: `روند عملکرد ${r.trend}`, severity: "watch", suggestedAction: "جلسه‌های اخیر و ریکاوری را بررسی کن." });
    }
    return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "act" ? -1 : 1));
  },
  weeklyBrief(): WeeklyCoachBrief {
    const attention = this.attention();
    return {
      weekLabel: "هفته جاری",
      activeAthletes: coachRoster.filter((r) => r.adherence > 0.5).length,
      avgAdherence: coachRoster.reduce((a, r) => a + r.adherence, 0) / coachRoster.length,
      attention,
      improvements: [...coachRoster].sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0)).slice(0, 3).map((r) => ({ athleteName: fullName(r), text: `+${r.improvement} در شاخص عملکرد · ${r.goal ?? ""}` })),
      recoveryConcerns: coachRoster.filter((r) => r.readiness < 60).map((r) => `${fullName(r)} — آمادگی ${r.readiness}`),
      nutritionFlags: coachRoster.filter((r) => (r.nutritionAdherence ?? 1) < 0.6).map((r) => `${fullName(r)} — ${Math.round((r.nutritionAdherence ?? 0) * 100)}٪`),
      followUps: attention.filter((a) => a.severity === "act").map((a) => `${a.athleteName}: ${a.suggestedAction}`),
      source: "mock",
    };
  },
};
