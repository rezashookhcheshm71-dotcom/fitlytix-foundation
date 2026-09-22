/**
 * Assessment Engine — service boundary.
 * Resolves templates, computes completion, and (later) persists answers.
 * TODO(backend): persist Assessment rows + trigger DNA derivation server-side.
 */
import type { AssessmentAnswers, AssessmentTemplate, ExperienceLevel, SportId } from "@/domain/types";
import { COMMON_ASSESSMENT, SPORT_ASSESSMENTS } from "@/domain/assessment/templates";

export const assessmentEngine = {
  getCommonTemplate(): AssessmentTemplate {
    return COMMON_ASSESSMENT;
  },
  getSportTemplate(sport: SportId): AssessmentTemplate {
    return SPORT_ASSESSMENTS[sport] ?? SPORT_ASSESSMENTS.crossfit;
  },
  /** Fields hidden for beginners; shown for advanced/elite athletes. */
  visibleFields(template: AssessmentTemplate, level: ExperienceLevel) {
    const advanced = level === "advanced" || level === "elite";
    return template.sections.map((s) => ({
      ...s,
      fields: s.fields.filter((f) => !f.advancedOnly || advanced),
    }));
  },
  completion(template: AssessmentTemplate, answers: AssessmentAnswers): number {
    const all = template.sections.flatMap((s) => s.fields);
    if (!all.length) return 0;
    const done = all.filter((f) => {
      const v = answers[f.id];
      return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    }).length;
    return done / all.length;
  },
  async submit(_athleteId: string, _templateId: string, _answers: AssessmentAnswers) {
    // TODO(backend): insert into assessments table; return Assessment
    return { status: "submitted" as const, mock: true };
  },
};
