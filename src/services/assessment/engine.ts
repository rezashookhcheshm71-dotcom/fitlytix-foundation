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
    return SPORT_ASSESSMENTS[sport];
  },
  /** Question depth grows with training experience without forcing specialist tests. */
  visibleFields(template: AssessmentTemplate, level: ExperienceLevel) {
    const rank: Record<ExperienceLevel, number> = { beginner: 0, intermediate: 1, advanced: 2, elite: 2 };
    const minimum = { all: 0, intermediatePlus: 1, advancedPlus: 2 } as const;
    return template.sections.map((s) => ({
      ...s,
      fields: s.fields.filter((f) => rank[level] >= minimum[f.depth ?? "all"]),
    })).filter((section) => section.fields.length > 0);
  },
  completion(template: AssessmentTemplate, answers: AssessmentAnswers): number {
    const fields = template.sections.flatMap((s) => s.fields);
    const required = fields.filter((field) => field.required);
    const all = required.length ? required : fields;
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
