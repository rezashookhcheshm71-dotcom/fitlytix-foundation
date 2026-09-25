import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, Plus, Scale } from "lucide-react";
import { BODY_FIELDS, BODY_SEGMENTS, type BodyAnalysisInput, type BodyAnalysisRecord, type BodyMetricKey } from "@/domain/body-analysis";
import type { SportId } from "@/domain/types";
import { bodyAnalysisService, type BodyRange } from "@/services/body-analysis/service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MockBadge, Panel, Pill } from "./primitives";

/* ---------------- Assessment intake ---------------- */

export type BodyIntakeState = { mode: "none" | "skip" | "has"; values: Record<string, string>; source: "inbody" | "manual" | "other" };

export const emptyBodyIntake = (): BodyIntakeState => ({ mode: "none", values: { measuredAt: new Date().toISOString().slice(0, 10) }, source: "inbody" });

/** Converts form strings to a domain input. Empty strings are simply omitted. */
export function toBodyInput(state: BodyIntakeState): Partial<BodyAnalysisInput> {
  const v = state.values;
  const num = (k: string) => (v[k] === undefined || v[k].trim() === "" ? undefined : Number(v[k].replace(/[٫,]/, ".")));
  const out: Record<string, unknown> = { measuredAt: v["measuredAt"], source: state.source, notes: v["notes"]?.trim() || undefined };
  for (const f of BODY_FIELDS) out[f.id] = num(f.id);
  const segmental: Record<string, { leanKg: number }> = {};
  for (const s of BODY_SEGMENTS) { const n = num(`seg.${s.id}`); if (n !== undefined) segmental[s.id] = { leanKg: n }; }
  if (Object.keys(segmental).length) out["segmental"] = segmental;
  return out as Partial<BodyAnalysisInput>;
}

export function BodyAnalysisIntake({ state, onChange, errors }: { state: BodyIntakeState; onChange: (s: BodyIntakeState) => void; errors: Record<string, string> }) {
  const [details, setDetails] = useState(false);
  const set = (k: string, val: string) => onChange({ ...state, values: { ...state.values, [k]: val } });
  const numberField = (f: (typeof BODY_FIELDS)[number]) => (
    <div key={f.id}>
      <div className="mb-1.5 flex items-center justify-between text-xs"><label htmlFor={`ba-${f.id}`} className="font-semibold">{f.label}</label><span className="font-mono text-[10px] text-muted-foreground">{f.unit}</span></div>
      <Input id={`ba-${f.id}`} dir="ltr" inputMode="decimal" placeholder={f.hint ?? "خالی = ندارم"} value={state.values[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)} className="h-10 bg-muted/40 font-mono" aria-invalid={Boolean(errors[f.id])} />
      {errors[f.id] && <p className="mt-1 text-[11px] text-destructive">{errors[f.id]}</p>}
    </div>
  );

  return (
    <section className="card-surface animate-rise relative overflow-hidden rounded-2xl p-5 md:p-6" aria-labelledby="ba-title">
      <header className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><Scale className="size-5" /></span>
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 id="ba-title" className="text-base font-bold">اگر آنالیز بدنت رو داری، اینجا واردش کن</h3><Pill>اختیاری</Pill></div>
          <p className="text-xs text-muted-foreground">نداری؟ مشکلی نیست؛ بعداً هم می‌تونی اضافه‌اش کنی.</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={state.mode === "has" ? "default" : "outline"} onClick={() => onChange({ ...state, mode: "has" })}>دارم، وارد می‌کنم</Button>
        <Button type="button" size="sm" variant={state.mode === "skip" ? "secondary" : "outline"} onClick={() => onChange({ ...state, mode: "skip" })}>فعلاً ندارم</Button>
      </div>

      {state.mode === "skip" && <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">باشه. هر وقت آنالیز گرفتی از داشبورد اضافه‌اش کن.</p>}

      {state.mode === "has" && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ba-date" className="mb-1.5 block text-xs font-semibold">تاریخ اندازه‌گیری</label>
              <Input id="ba-date" type="date" dir="ltr" value={state.values["measuredAt"] ?? ""} onChange={(e) => set("measuredAt", e.target.value)} className="h-10 bg-muted/40 font-mono" />
              {errors["measuredAt"] && <p className="mt-1 text-[11px] text-destructive">{errors["measuredAt"]}</p>}
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold">از کجا گرفتی؟</span>
              <div className="flex flex-wrap gap-1.5">
                {([["inbody", "دستگاه InBody"], ["manual", "خودم اندازه گرفتم"], ["other", "دستگاه دیگر"]] as const).map(([id, label]) => (
                  <Button key={id} type="button" size="sm" variant={state.source === id ? "default" : "outline"} className="h-8 text-xs" onClick={() => onChange({ ...state, source: id })}>{label}</Button>
                ))}
              </div>
            </div>
            {BODY_FIELDS.filter((f) => f.level === "basic").map(numberField)}
          </div>

          <div className="border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" size="sm" className="px-0 text-xs" onClick={() => setDetails((d) => !d)} aria-expanded={details}>
              جزئیات بیشتر (اگر برگه‌ات دارد) <ChevronDown className={cn("transition-transform", details && "rotate-180")} />
            </Button>
            {details && (
              <div className="mt-3 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">{BODY_FIELDS.filter((f) => f.level === "detail").map(numberField)}</div>
                <div>
                  <div className="mb-2 text-xs font-semibold">عضله هر ناحیه (Segmental Lean) <span className="font-mono text-[10px] text-muted-foreground">kg</span></div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {BODY_SEGMENTS.map((s) => (
                      <div key={s.id}><label htmlFor={`seg-${s.id}`} className="mb-1 block text-[11px] text-muted-foreground">{s.label}</label><Input id={`seg-${s.id}`} dir="ltr" inputMode="decimal" value={state.values[`seg.${s.id}`] ?? ""} onChange={(e) => set(`seg.${s.id}`, e.target.value)} className="h-9 bg-muted/40 font-mono" /></div>
                    ))}
                  </div>
                </div>
                <Textarea placeholder="نکته‌ای درباره این اندازه‌گیری؟ (مثلاً ناشتا بودم)" value={state.values["notes"] ?? ""} onChange={(e) => set("notes", e.target.value)} className="min-h-20 bg-muted/40" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">هر عددی که برگه‌ات ندارد را خالی بگذار. این داده‌ها بعداً کمک می‌کنند حجم تمرین و برنامه غذایی دقیق‌تر تنظیم شود.</p>
        </div>
      )}
    </section>
  );
}

/* ---------------- Dashboard: تغییرات بدن ---------------- */

const METRICS: Record<BodyMetricKey, { label: string; unit: string; color: string; goodDown?: boolean }> = {
  weightKg: { label: "وزن", unit: "kg", color: "var(--chart-2)" },
  bodyFatPct: { label: "درصد چربی", unit: "%", color: "var(--primary)", goodDown: true },
  skeletalMuscleKg: { label: "توده عضلانی", unit: "kg", color: "var(--success)" },
};

const faDate = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

export function BodyChangesPanel({ records, sport, onAdd }: { records: BodyAnalysisRecord[]; sport: SportId; onAdd: () => void }) {
  const [range, setRange] = useState<BodyRange>("all");
  const visible = useMemo(() => bodyAnalysisService.inRange(records, range), [records, range]);
  const deltas = useMemo(() => bodyAnalysisService.deltas(visible), [visible]);
  const summary = bodyAnalysisService.summary(visible, sport);
  const latest = records.at(-1);

  const addButton = <Button size="sm" variant="outline" onClick={onAdd}><Plus /> ثبت اندازه‌گیری جدید</Button>;

  if (!latest) {
    return (
      <Panel className="mb-6">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted"><Scale className="size-6 text-muted-foreground" /></span>
          <h2 className="text-lg font-bold">آنالیز بدنت رو داری؟</h2>
          <p className="max-w-sm text-sm text-muted-foreground">نداری؟ اشکالی نداره. هر وقت InBody یا اندازه‌گیری دستی داشتی ثبتش کن تا تغییرات بدنت را کنار تمرین ببینی.</p>
          {addButton}
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="mb-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold md:text-lg">تغییرات بدن</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Pill>آخرین اندازه‌گیری · {faDate(latest.measuredAt)}</Pill>
            <span>{records.length} اندازه‌گیری</span>
            <MockBadge />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {records.length > 1 && (
            <div className="flex rounded-lg bg-muted/50 p-0.5" role="group" aria-label="بازه زمانی">
              {([["8w", "۸ هفته"], ["12w", "۱۲ هفته"], ["all", "همه"]] as const).map(([id, label]) => (
                <Button key={id} size="sm" variant={range === id ? "secondary" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setRange(id)}>{label}</Button>
              ))}
            </div>
          )}
          {addButton}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {deltas.map((d) => {
          const m = METRICS[d.key];
          const series = visible.filter((r) => typeof r[d.key] === "number").map((r) => ({ date: shortDate(r.measuredAt), value: r[d.key] as number }));
          return (
            <div key={d.key} className="rounded-xl bg-muted/30 p-4 ring-1 ring-border/60">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{m.label}</span><span className="font-mono">{m.unit}</span></div>
              <div className="num mt-1 text-2xl font-bold">{d.latest ?? "—"}</div>
              {records.length > 1 ? (
                <>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    {d.vsPrevious !== undefined && <span>نسبت به قبلی <b className={cn("num", tone(d.vsPrevious, m.goodDown))}>{signed(d.vsPrevious)}</b></span>}
                    {d.vsFirst !== undefined && <span>از شروع <b className={cn("num", tone(d.vsFirst, m.goodDown))}>{signed(d.vsFirst)}</b></span>}
                  </div>
                  {series.length > 1 && <TrendChart data={series} color={m.color} label={m.label} />}
                </>
              ) : d.latest === undefined ? <p className="mt-1 text-[11px] text-muted-foreground">در این اندازه‌گیری ثبت نشده</p> : null}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        {records.length > 1 ? summary : "برای دیدن روند، یک اندازه‌گیری دیگر در تاریخ بعد اضافه کن."}
      </p>
    </Panel>
  );
}

function tone(delta: number, goodDown?: boolean) {
  if (delta === 0) return "text-muted-foreground";
  return (goodDown ? delta < 0 : delta > 0) ? "text-success" : "text-foreground";
}

function TrendChart({ data, color, label }: { data: { date: string; value: number }[]; color: string; label: string }) {
  return (
    <div className="mt-3 h-24 w-full" style={{ direction: "ltr" }} aria-label={`روند ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
          <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" }} formatter={(v: number) => [v, label]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
