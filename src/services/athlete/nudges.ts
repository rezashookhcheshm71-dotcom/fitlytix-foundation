/**
 * Athlete nudges — «چه کاری همین حالا بیشترین اثر را دارد؟»
 *
 * Pure logic on purpose: the rules are testable without a database, and the server layer only
 * feeds them timestamps. Nothing here invents a streak or a score; every nudge is derived from
 * something that either happened or did not happen.
 *
 * The rules exist because the data loop is the product's bottleneck: a plan with no logged
 * behaviour cannot be labelled (`MIN_WINDOW_DAYS = 3`), and unlabelled plans cannot retrain the
 * model. Nudging the athlete is therefore not a growth trick, it is the input the engine needs.
 */

export type NudgeCode =
  | "plan_missing"
  | "nothing_logged_3d"
  | "checkin_missing_today"
  | "nutrition_missing_3d"
  | "label_window_open";

export interface Nudge {
  code: NudgeCode;
  titleFa: string;
  bodyFa: string;
  /** Where the athlete should go to act on it. */
  actionFa: string;
  severity: "info" | "action";
}

export interface NudgeFacts {
  hasPlan: boolean;
  /** Age of the newest plan in days; null when there is no plan. */
  planAgeDays: number | null;
  /** Days since the last session log; null when the athlete never logged one. */
  daysSinceSession: number | null;
  /** Days since the last check-in; null when none. */
  daysSinceCheckin: number | null;
  /** Days since the last meal log; null when none. */
  daysSinceNutrition: number | null;
  /** Whether a check-in exists for today (server's local date). */
  checkedInToday: boolean;
}

export const NUDGE_THRESHOLDS = {
  /** Two quiet days is a weekend; three is a pattern. */
  inactivityDays: 3,
  /** The label window in outcomes.server.ts; before this a plan cannot be labelled at all. */
  labelWindowDays: 3,
} as const;

export function computeNudges(facts: NudgeFacts): Nudge[] {
  const nudges: Nudge[] = [];

  if (!facts.hasPlan) {
    nudges.push({
      code: "plan_missing",
      titleFa: "هنوز برنامه‌ای نساخته‌اید",
      bodyFa: "بدون برنامه، هیچ داده‌ای هم معنا پیدا نمی‌کند: اول ارزیابی، بعد برنامه.",
      actionFa: "تکمیل ارزیابی و ساخت برنامه",
      severity: "action",
    });
    return nudges;
  }

  const quiet = facts.daysSinceSession;
  if (quiet === null || quiet >= NUDGE_THRESHOLDS.inactivityDays) {
    nudges.push({
      code: "nothing_logged_3d",
      titleFa:
        quiet === null
          ? "هیچ جلسه‌ای ثبت نشده است"
          : `${quiet.toLocaleString("fa-IR")} روز است جلسه‌ای ثبت نکرده‌اید`,
      bodyFa:
        "بدون ثبت جلسه، موتور نمی‌فهمد برنامه‌تان جواب داده یا نه و برنامهٔ بعدی روی حدس می‌ماند.",
      actionFa: "ثبت جلسهٔ امروز",
      severity: "action",
    });
  }

  if (!facts.checkedInToday) {
    nudges.push({
      code: "checkin_missing_today",
      titleFa: "چک‌این امروز ثبت نشده",
      bodyFa:
        "خواب، استرس و آمادگی همان سه سیگنالی هستند که بار تمرین را تنظیم می‌کنند؛ بدون آن‌ها برنامه محافظه‌کارتر می‌شود.",
      actionFa: "ثبت چک‌این روزانه",
      severity: "action",
    });
  }

  const meals = facts.daysSinceNutrition;
  if (meals !== null && meals >= NUDGE_THRESHOLDS.inactivityDays) {
    nudges.push({
      code: "nutrition_missing_3d",
      titleFa: "تغذیه چند روزی ثبت نشده",
      bodyFa:
        "پایبندی تغذیه جدا از تمرین اندازه‌گیری می‌شود؛ بدون ثبت، این بخش از مدل کور می‌ماند.",
      actionFa: "ثبت وعده",
      severity: "info",
    });
  }

  const age = facts.planAgeDays;
  if (age !== null && age >= NUDGE_THRESHOLDS.labelWindowDays) {
    nudges.push({
      code: "label_window_open",
      titleFa: "پنجرهٔ سنجش این برنامه باز شده",
      bodyFa:
        "از روز سوم، رفتار شما به برچسب واقعی برنامه تبدیل می‌شود؛ ثبت‌های این هفته مستقیماً روی برنامهٔ بعدی اثر می‌گذارد.",
      actionFa: "ادامهٔ ثبت روزانه",
      severity: "info",
    });
  }

  return nudges;
}
