/**
 * Coach proposal service (training + nutrition). A replaceable provider produces DRAFTS from Athlete 360
 * context; only an explicit coach approval turns a draft into a coach-owned plan. Nothing is auto-published.
 * Current provider: deterministic mock — no model/API is connected.
 * TODO(backend): implement ProposalProvider in a server function calling the chosen model; persist ai_proposals.
 */
import type { AIProposal, AIProposalStatus, CoachAthleteSummary, ProposalSection } from "@/domain/types";
import { SPORT_DASHBOARDS } from "@/mock/sport-dashboard";
import { nutritionService } from "@/services/nutrition/service";

export interface ProposalProvider {
  draftTraining(a: CoachAthleteSummary, goal: string): Promise<Omit<AIProposal, "id" | "status" | "createdAt">>;
  draftNutrition(a: CoachAthleteSummary, goal: string): Promise<Omit<AIProposal, "id" | "status" | "createdAt">>;
}

const TRAINING_STRUCTURE: Record<string, string[]> = {
  crossfit: ["گرم کردن", "قدرت / بدنسازی", "Engine", "WOD", "مهارت", "وزنه‌برداری", "سرد کردن"],
  bodybuilding: ["گرم کردن", "حرکت اصلی", "حجم / فرعی‌ها", "هوازی (اختیاری)", "سرد کردن"],
  hyrox: ["گرم کردن", "دویدن / Engine", "ایستگاه‌ها", "استقامت قدرتی", "تمرین مسابقه", "سرد کردن"],
  functional: ["گرم کردن", "حرکت و تحرک", "قدرت", "کاندیشنینگ", "Core / تعادل", "سرد کردن"],
  running: ["گرم کردن / دریل", "دویدن اصلی", "قدرت و تحرک", "سرد کردن"],
};

const mockProvider: ProposalProvider = {
  async draftTraining(a, goal) {
    const sport = a.athlete.primarySport;
    const snap = SPORT_DASHBOARDS[sport];
    const light = a.readiness < 60;
    const sections: ProposalSection[] = [
      { id: "week", title: "ساختار هفته", lines: [`${a.adherence < 0.75 ? 3 : 4} جلسه در هفته`, light ? "هفته اول با حجم ۸۰٪" : "پیشرفت تدریجی حجم ۵٪ در هفته", `جلسه نمونه: ${snap.workout.title}`] },
      ...TRAINING_STRUCTURE[sport]!.map((t, i) => ({ id: `b${i}`, title: t, lines: [i === 0 ? "۸–۱۰ دقیقه تحرک و فعال‌سازی" : i === TRAINING_STRUCTURE[sport]!.length - 1 ? "۵–۸ دقیقه تنفس و کشش" : `${light ? "RPE 6–7" : "RPE 7–8"} · استراحت ۹۰ ثانیه · اسکیلینگ متناسب با سطح`] })),
    ];
    return { kind: "training", athleteId: a.athlete.id, coachId: "coach_001", goal, sections, rationale: [`هدف: ${goal}`, `آمادگی فعلی ${a.readiness}${light ? " — شروع محافظه‌کارانه" : ""}`, `پایبندی ${Math.round(a.adherence * 100)}٪ — تعداد جلسه واقع‌بینانه`, `ساختار جلسه مخصوص ${sport}`], sourceContext: ["athlete", "goal", "recovery", "training", "dna"], provider: "mock" };
  },
  async draftNutrition(a, goal) {
    const plan = nutritionService.getDailyPlan(a.athlete.id, "training");
    const rest = nutritionService.getDailyPlan(a.athlete.id, "rest");
    return {
      kind: "nutrition", athleteId: a.athlete.id, coachId: "coach_001", goal,
      sections: [
        { id: "train", title: "روز تمرین", lines: plan.meals.map((m) => `${m.title} (${m.timing}): ${m.idea}`) },
        { id: "rest", title: "روز استراحت", lines: rest.meals.map((m) => `${m.title}: ${m.idea}`) },
        { id: "hyd", title: "آب", lines: [`حدود ${plan.hydrationL} لیتر در روز تمرین`] },
      ],
      rationale: [`هدف: ${goal}`, a.nutritionAdherence !== undefined ? `پایبندی فعلی تغذیه ${Math.round(a.nutritionAdherence * 100)}٪ — وعده‌ها ساده نگه داشته شده` : "داده پایبندی تغذیه ثبت نشده", "این یک ساختار پیشنهادی است، نه نسخه درمانی."],
      sourceContext: ["athlete", "goal", "nutrition", "training"], provider: "mock",
    };
  },
};

let provider: ProposalProvider = mockProvider;
const store: AIProposal[] = [];
const uid = () => `prop_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const proposalService = {
  setProvider(p: ProposalProvider) { provider = p; },
  async create(kind: "training" | "nutrition", athlete: CoachAthleteSummary, goal: string): Promise<AIProposal> {
    const draft = kind === "training" ? await provider.draftTraining(athlete, goal) : await provider.draftNutrition(athlete, goal);
    const p: AIProposal = { ...draft, id: uid(), status: "needs_review", createdAt: new Date().toISOString() };
    store.push(p);
    return p;
  },
  list(athleteId?: string) {
    return store.filter((p) => !athleteId || p.athleteId === athleteId);
  },
  updateSections(id: string, sections: ProposalSection[]) {
    const p = store.find((x) => x.id === id);
    if (p && p.status !== "approved") p.sections = sections;
    return p;
  },
  /** Only path to a coach-owned plan. */
  setStatus(id: string, status: Extract<AIProposalStatus, "approved" | "rejected">) {
    const p = store.find((x) => x.id === id);
    if (!p) return undefined;
    p.status = status;
    if (status === "approved") p.approvedAt = new Date().toISOString();
    return p;
  },
};
