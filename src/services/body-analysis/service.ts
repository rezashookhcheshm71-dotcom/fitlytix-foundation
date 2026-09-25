/**
 * Body Analysis service — append-only repository + trend math.
 * TODO(backend): replace the in-memory store with inserts/selects on body_analysis_records. Never UPDATE a measurement; add a new row.
 */
import { bodyAnalysisInputSchema, type BodyAnalysisInput, type BodyAnalysisRecord, type BodyMetricKey } from "@/domain/body-analysis";
import type { SportId } from "@/domain/types";
import { DEMO_BODY_RECORDS } from "@/mock/body-analysis";

const store: BodyAnalysisRecord[] = [...DEMO_BODY_RECORDS];

export type BodyRange = "all" | "12w" | "8w";

export interface MetricDelta {
  key: BodyMetricKey;
  latest?: number | undefined;
  vsPrevious?: number | undefined;
  vsFirst?: number | undefined;
}

const byDate = (a: BodyAnalysisRecord, b: BodyAnalysisRecord) => a.measuredAt.localeCompare(b.measuredAt) || a.createdAt.localeCompare(b.createdAt);
const round = (n: number) => Math.round(n * 10) / 10;

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")) as T;
}

export const bodyAnalysisService = {
  list(athleteId: string): BodyAnalysisRecord[] {
    return store.filter((r) => r.athleteId === athleteId).sort(byDate);
  },
  latest(athleteId: string): BodyAnalysisRecord | undefined {
    return this.list(athleteId).at(-1);
  },
  validate(input: unknown) {
    return bodyAnalysisInputSchema.safeParse(input);
  },
  /** Always creates a new record; existing measurements are never overwritten. */
  add(athleteId: string, input: BodyAnalysisInput): BodyAnalysisRecord {
    const parsed = bodyAnalysisInputSchema.parse(input);
    const record = clean({
      ...parsed,
      id: `ba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      athleteId,
      version: 1 as const,
      createdAt: new Date().toISOString(),
    }) as unknown as BodyAnalysisRecord;
    store.push(Object.freeze(record) as BodyAnalysisRecord);
    return record;
  },
  inRange(records: BodyAnalysisRecord[], range: BodyRange) {
    if (range === "all" || records.length === 0) return records;
    const last = new Date(records.at(-1)!.measuredAt).getTime();
    const weeks = range === "12w" ? 12 : 8;
    return records.filter((r) => last - new Date(r.measuredAt).getTime() <= weeks * 7 * 86_400_000);
  },
  deltas(records: BodyAnalysisRecord[]): MetricDelta[] {
    return (["weightKg", "bodyFatPct", "skeletalMuscleKg"] as BodyMetricKey[]).map((key) => {
      const withValue = records.filter((r) => typeof r[key] === "number");
      const latest = withValue.at(-1)?.[key];
      const prev = withValue.at(-2)?.[key];
      const first = withValue[0]?.[key];
      return {
        key,
        latest,
        vsPrevious: latest !== undefined && prev !== undefined ? round(latest - prev) : undefined,
        vsFirst: latest !== undefined && first !== undefined && withValue.length > 1 ? round(latest - first) : undefined,
      };
    });
  },
  /** Plain-language summary strictly from the numbers available. No medical claims. */
  summary(records: BodyAnalysisRecord[], sport: SportId): string | undefined {
    if (records.length < 2) return undefined;
    const first = records[0]!;
    const last = records.at(-1)!;
    const weeks = Math.max(1, Math.round((new Date(last.measuredAt).getTime() - new Date(first.measuredAt).getTime()) / (7 * 86_400_000)));
    const dw = last.weightKg - first.weightKg;
    const weight = Math.abs(dw) < 1 ? "وزن تقریباً ثابت بوده" : dw > 0 ? `وزن حدود ${round(dw)} کیلو بالا رفته` : `وزن حدود ${round(-dw)} کیلو پایین آمده`;
    const parts = [weight];
    if (first.bodyFatPct !== undefined && last.bodyFatPct !== undefined) {
      const df = last.bodyFatPct - first.bodyFatPct;
      parts.push(Math.abs(df) < 0.5 ? "درصد چربی تغییر خاصی نکرده" : df < 0 ? "درصد چربی پایین‌تر آمده" : "درصد چربی کمی بالاتر رفته");
    }
    if (first.skeletalMuscleKg !== undefined && last.skeletalMuscleKg !== undefined) {
      const dm = last.skeletalMuscleKg - first.skeletalMuscleKg;
      if (Math.abs(dm) >= 0.3) parts.push(dm > 0 ? "توده عضلانی کمی بیشتر شده" : "توده عضلانی کمی کمتر شده");
    }
    const joined = parts.length > 1 ? `${parts.slice(0, -1).join("، ")} و ${parts.at(-1)}` : parts[0];
    return `در ${weeks} هفته گذشته ${joined}. ${SPORT_BODY_NOTE[sport]}`;
  },
};

const SPORT_BODY_NOTE: Record<SportId, string> = {
  crossfit: "برای کراس‌فیت، ثابت ماندن وزن با عضله بیشتر یعنی حرکات بدن‌وزن و لیفت‌ها هم‌زمان جلو می‌روند.",
  bodybuilding: "برای بدنسازی، روند توده عضلانی مهم‌تر از عدد ترازوست؛ با همین سرعت ادامه بده.",
  hyrox: "در HYROX نسبت قدرت به وزن روی سورتمه و دویدن هر دو اثر دارد؛ این روند به نفعت است.",
  functional: "برای تمرین فانکشنال، ترکیب بدن متعادل کمک می‌کند کنترل و تحرک راحت‌تر بهتر شود.",
  running: "در دویدن، وزن پایدار با چربی کمتر معمولاً روی پیس راحت‌تر اثر خوبی دارد.",
};
