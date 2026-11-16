/**
 * «چه چیزی عوض شد؟» — a plain-language diff between two generated plans.
 *
 * The engine is deterministic: the same inputs always produce the same plan, which is what makes
 * a stored plan reproducible. The consequence is that pressing "regenerate" with unchanged
 * inputs cannot produce a new plan, so the UI must be able to say *that* instead of pretending
 * something happened. This module is the honest middle layer between the two.
 */
import type { PlanRecommendation } from "@/domain/recommendation";

export interface PlanChange {
  /** Persian field name, e.g. «جلسه در هفته». */
  labelFa: string;
  fromFa: string;
  toFa: string;
}

export function describePlanChanges(
  previous: PlanRecommendation | null | undefined,
  next: PlanRecommendation,
): PlanChange[] {
  if (!previous) return [];
  const changes: PlanChange[] = [];

  const compare = (labelFa: string, from: string | number, to: string | number) => {
    if (String(from) === String(to)) return;
    changes.push({ labelFa, fromFa: String(from), toFa: String(to) });
  };

  compare("جلسه در هفته", previous.program.sessionsPerWeek, next.program.sessionsPerWeek);
  compare("دقیقه هر جلسه", previous.program.sessionMinutes, next.program.sessionMinutes);
  compare("هفته‌های چرخه", previous.program.weeks, next.program.weeks);
  compare("نوع تمرین", previous.program.labelFa, next.program.labelFa);
  compare("ساختار تغذیه", previous.nutrition.labelFa, next.nutrition.labelFa);
  compare("طول دوره", previous.duration.labelFa, next.duration.labelFa);
  compare("نوع مربی‌گری", previous.coaching.labelFa, next.coaching.labelFa);
  compare("بسته", previous.package.nameFa, next.package.nameFa);

  return changes;
}

/** One line the athlete can read without opening anything. */
export function summarizePlanChanges(changes: PlanChange[]): string {
  if (changes.length === 0) return "برنامه عوض نشد.";
  return changes
    .map((change) => `${change.labelFa}: ${change.fromFa} → ${change.toFa}`)
    .join(" · ");
}
