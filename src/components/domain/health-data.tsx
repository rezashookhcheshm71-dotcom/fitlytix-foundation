import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Link2, PenLine, Plus, ShieldCheck, Unplug, Watch, WatchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATUS_LABEL,
  HEALTH_PROVIDERS,
  HEALTH_SCOPE_LABEL,
  MANUAL_METRICS,
  METRIC_DEFS,
  PROVIDER_LABEL,
  PROVIDER_SCOPES,
  PROVIDER_TRANSPORT,
  TRANSPORT_NOTE,
  type ConnectionStatus,
  type HealthMetricType,
  type HealthProvider,
  type HealthProviderConnection,
  type WearableIntent,
} from "@/domain/types";
import { healthDataService } from "@/services/health-data/service";
import { Panel, Pill, SectionHeading } from "./primitives";

export const PRIVACY_NOTE = "دسترسی به داده‌های سلامت اختیاری است. فقط داده‌هایی که اجازه می‌دهی برای تحلیل تمرین و ریکاوری FitLytix استفاده می‌شوند.";
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fa-IR") : undefined);

/* Assessment intake ------------------------------------------------------- */

export type WearableIntakeState = { intent?: WearableIntent | undefined; providers: HealthProvider[] };

export function WearableIntake({ state, onChange }: { state: WearableIntakeState; onChange: (s: WearableIntakeState) => void }) {
  const choices: { v: WearableIntent; l: string; icon: typeof Watch }[] = [
    { v: "yes", l: "بله، ساعت/سنسور دارم", icon: Watch },
    { v: "no", l: "خیر، فعلاً استفاده نمی‌کنم", icon: Unplug },
    { v: "manual", l: "اطلاعاتم را دستی وارد می‌کنم", icon: PenLine },
  ];
  const toggle = (p: HealthProvider) =>
    onChange({ intent: "yes", providers: state.providers.includes(p) ? state.providers.filter((x) => x !== p) : [...state.providers, p] });
  const tile = (on: boolean) =>
    cn("h-auto min-h-11 justify-start gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold whitespace-normal", on ? "border-primary bg-primary-soft text-primary" : "bg-muted/40 text-muted-foreground");

  return (
    <section className="card-surface animate-rise relative overflow-hidden rounded-2xl p-5 md:p-6" style={{ borderInlineStartWidth: 3, borderInlineStartColor: "var(--primary)" }} aria-labelledby="wearable-title">
      <header className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Watch className="size-5" /></span>
        <div>
          <h3 id="wearable-title" className="text-base font-bold">از ساعت یا سنسور هوشمند استفاده می‌کنی؟</h3>
          <p className="text-xs leading-6 text-muted-foreground">اگر داده‌های تمرین، خواب و ریکاوری‌ات را با FitLytix به اشتراک بگذاری، می‌توانیم شناخت دقیق‌تری از وضعیت و عملکردت داشته باشیم.</p>
        </div>
      </header>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="استفاده از ساعت هوشمند">
        {choices.map((c) => {
          const on = state.intent === c.v;
          return (
            <Button key={c.v} type="button" variant="outline" role="radio" aria-checked={on} className={tile(on)}
              onClick={() => onChange(on ? { providers: [] } : { intent: c.v, providers: c.v === "yes" ? state.providers : [] })}>
              <c.icon className="size-3.5 shrink-0" />{c.l}
            </Button>
          );
        })}
      </div>
      {state.intent === "yes" && (
        <div className="mt-4 animate-rise">
          <div className="mb-2 text-xs font-semibold">از کدام دستگاه یا سرویس؟</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="منبع داده سلامت">
            {HEALTH_PROVIDERS.map((p) => {
              const on = state.providers.includes(p);
              return (
                <Button key={p} type="button" variant="outline" aria-pressed={on} onClick={() => toggle(p)} className={tile(on)}>
                  {on ? <Check className="size-3.5 shrink-0" /> : <WatchIcon className="size-3.5 shrink-0 opacity-50" />}{PROVIDER_LABEL[p]}
                </Button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">اتصال بعد از ساخت حساب از داشبورد انجام می‌شود؛ الان فقط منبع را مشخص می‌کنی.</p>
        </div>
      )}
      {state.intent === "manual" && <p className="mt-3 text-[11px] leading-5 text-muted-foreground">بعد از ورود، از داشبورد هر وقت خواستی چند عدد پایه را ثبت کن؛ کاملاً اختیاری است.</p>}
      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />فقط داده‌هایی که خودت اجازه بدهی استفاده می‌شوند و می‌توانی دسترسی را بعداً مدیریت یا قطع کنی.</p>
    </section>
  );
}

/* Privacy / permission step ---------------------------------------------- */

export function ConnectPermissionDialog({ provider, onOpenChange }: { provider: HealthProvider | null; onOpenChange: (o: boolean) => void }) {
  const result = provider ? healthDataService.requestConnect(provider) : null;
  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />اتصال {provider ? PROVIDER_LABEL[provider] : ""}</DialogTitle>
          <DialogDescription className="leading-6">{PRIVACY_NOTE} هر زمان بخواهی می‌توانی دسترسی‌ها را تغییر بدهی یا کامل قطع کنی.</DialogDescription>
        </DialogHeader>
        {provider && PROVIDER_SCOPES[provider].length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold">داده‌هایی که درخواست خواهد شد:</div>
            <div className="flex flex-wrap gap-1.5">{PROVIDER_SCOPES[provider].map((s) => <Pill key={s}>{HEALTH_SCOPE_LABEL[s]}</Pill>)}</div>
          </div>
        )}
        {provider && <Pill>{TRANSPORT_NOTE[PROVIDER_TRANSPORT[provider]]}</Pill>}
        {result && !result.available && <p role="status" className="rounded-lg bg-info/10 p-3 text-xs leading-6 text-info">{result.message}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>بستن</Button>
          <Button variant="hero" disabled={!result?.available}>{result?.available ? "ادامه" : "به‌زودی"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Connections list -------------------------------------------------------- */

const statusColor: Record<ConnectionStatus, string> = {
  not_connected: "var(--muted-foreground)",
  pending: "var(--info)",
  connected: "var(--success)",
  syncing: "var(--info)",
  error: "var(--destructive)",
  revoked: "var(--muted-foreground)",
};

export function WearableConnections({ athleteId, connections, onChanged }: { athleteId: string; connections: HealthProviderConnection[]; onChanged: () => void }) {
  const [connecting, setConnecting] = useState<HealthProvider | null>(null);
  if (!connections.length) return null;
  return (
    <>
      <ul className="mb-4 divide-y divide-border/60 rounded-xl bg-muted/30" aria-label="دستگاه‌ها">
        {connections.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{PROVIDER_LABEL[c.provider]}</span>
                <Pill color={statusColor[c.status]}>{CONNECTION_STATUS_LABEL[c.status]}</Pill>
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 text-[11px] text-muted-foreground">
                <div>تاریخ اتصال: <span className="num">{fmtDate(c.connectedAt) ?? "—"}</span></div>
                <div>آخرین همگام‌سازی: <span className="num">{fmtDate(c.lastSyncAt) ?? "هنوز نه"}</span></div>
                <div className="col-span-2">دسترسی‌ها: {c.scopes?.length ? c.scopes.map((s) => HEALTH_SCOPE_LABEL[s]).join("، ") : "هنوز دسترسی‌ای داده نشده"}</div>
              </dl>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setConnecting(c.provider)}><Link2 /> اتصال</Button>
              <Button size="sm" variant="ghost" aria-label={`حذف ${PROVIDER_LABEL[c.provider]}`} onClick={() => { healthDataService.disconnect(athleteId, c.id); onChanged(); }}><Unplug /> حذف</Button>
            </div>
          </li>
        ))}
      </ul>
      <ConnectPermissionDialog provider={connecting} onOpenChange={(o) => !o && setConnecting(null)} />
    </>
  );
}

/* Smart Health Data panel (dashboard + health page) ----------------------- */

const SLOTS: HealthMetricType[] = ["hrv", "resting_hr", "sleep_duration", "vo2max", "recovery"];

export function HealthDataPanel({ athleteId, empty, version, onChanged }: { athleteId: string; empty?: boolean; version: number; onChanged: () => void }) {
  const [manualOpen, setManualOpen] = useState(false);
  void version;
  const connections = empty ? [] : healthDataService.listConnections(athleteId);
  const latest = empty ? {} : healthDataService.latestByType(athleteId);
  const status: ConnectionStatus = empty ? "not_connected" : healthDataService.overallStatus(athleteId);
  const hasAny = Object.keys(latest).length > 0;
  const manualCount = empty ? 0 : healthDataService.listManualEntries(athleteId).length;
  const sources = empty ? [] : Array.from(new Set(healthDataService.listMetrics(athleteId).map((m) => m.source)));
  const lastSync = connections.map((c) => c.lastSyncAt).filter(Boolean).sort().at(-1);
  const isDemo = Object.values(latest).some((m) => m?.metadata?.["demo"] === true);
  const emptyCopy =
    status === "pending" ? "دستگاهت را انتخاب کرده‌ای؛ اتصال مستقیم در نسخه بعدی فعال می‌شود. تا آن موقع می‌توانی دستی ثبت کنی."
    : status === "connected" ? "دستگاه وصل است ولی هنوز داده‌ای همگام نشده."
    : "ساعت نداری؟ مشکلی نیست؛ خواب و ضربان استراحت را دستی وارد کن.";

  return (
    <Panel className="mb-6">
      <SectionHeading title="داده‌های سلامت و پوشیدنی‌ها" subtitle="ساعت، اپ سلامت یا ورود دستی" />
      <dl className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-xl bg-muted/30 p-3"><dt className="text-muted-foreground">دستگاه‌ها</dt><dd className="num mt-1 font-bold">{connections.length}</dd></div>
        <div className="rounded-xl bg-muted/30 p-3"><dt className="text-muted-foreground">آخرین همگام‌سازی</dt><dd className="num mt-1 font-bold">{fmtDate(lastSync) ?? "هنوز نه"}</dd></div>
        <div className="rounded-xl bg-muted/30 p-3"><dt className="text-muted-foreground">منابع داده</dt><dd className="mt-1 font-bold">{sources.length ? sources.map((x) => PROVIDER_LABEL[x]).join("، ") : "—"}</dd></div>
        <div className="rounded-xl bg-muted/30 p-3"><dt className="text-muted-foreground">ثبت دستی</dt><dd className="num mt-1 font-bold">{manualCount}</dd></div>
      </dl>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill color={statusColor[status]}>{CONNECTION_STATUS_LABEL[status]}</Pill>
        {isDemo && <Pill>نمونه نمایشی</Pill>}
        <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}><Plus /> ورود دستی</Button>
        <Link to="/athlete/health" className="text-xs font-semibold text-primary">مدیریت اتصال‌ها</Link>
      </div>

      <WearableConnections athleteId={athleteId} connections={connections} onChanged={onChanged} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {SLOTS.map((k) => {
          const m = latest[k];
          return (
            <div key={k} className="rounded-xl bg-muted/40 p-3">
              <div className="text-[11px] text-muted-foreground">{METRIC_DEFS[k].label}</div>
              {m ? (
                <>
                  <div className="num mt-1 text-lg font-bold">{m.value.toLocaleString("en-US")} <span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span></div>
                  <div className="text-[10px] text-muted-foreground">{PROVIDER_LABEL[m.source]} · <span className="num">{fmtDate(m.startTime)}</span></div>
                </>
              ) : (
                <>
                  <div className="num mt-1 text-lg font-bold text-muted-foreground/50">—</div>
                  <div className="text-[10px] text-muted-foreground">هنوز ثبت نشده</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {!hasAny && <p className="mt-3 text-xs leading-6 text-muted-foreground">{emptyCopy}</p>}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{PRIVACY_NOTE}</p>
      <ManualHealthDialog open={manualOpen} onOpenChange={setManualOpen} athleteId={athleteId} onSaved={onChanged} />
    </Panel>
  );
}

export function ManualHealthDialog({ open, onOpenChange, athleteId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; athleteId: string; onSaved: () => void }) {
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [vals, setVals] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const save = () => {
    const values = Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)]));
    const parsed = healthDataService.validateManual({ measuredAt, values, ...(notes.trim() ? { notes } : {}) });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path.at(-1)), i.message])));
      return;
    }
    healthDataService.addManual(athleteId, parsed.data);
    setVals({}); setNotes(""); setErrors({}); onOpenChange(false); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>ثبت دستی داده سلامت</DialogTitle>
          <DialogDescription>هر عددی را که داری وارد کن؛ بقیه را خالی بگذار. هر ثبت یک رکورد تازه است.</DialogDescription>
        </DialogHeader>
        <label className="text-xs font-semibold">زمان اندازه‌گیری
          <Input type="datetime-local" dir="ltr" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} className="mt-1 bg-muted/40" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {MANUAL_METRICS.map((k) => (
            <label key={k} className="text-xs font-semibold">
              <span className="flex justify-between">{METRIC_DEFS[k].label}<span className="font-mono text-[10px] text-muted-foreground">{METRIC_DEFS[k].unit}</span></span>
              <Input dir="ltr" inputMode="decimal" value={vals[k] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} aria-invalid={Boolean(errors[k])} className="mt-1 bg-muted/40 font-mono" placeholder="—" />
              {errors[k] && <span className="mt-1 block text-[10px] text-destructive">{errors[k]}</span>}
            </label>
          ))}
        </div>
        <label className="text-xs font-semibold">یادداشت (اختیاری)
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="مثلاً: بعد از تمرین سنگین دیروز" className="mt-1 bg-muted/40" />
          {errors["notes"] && <span className="mt-1 block text-[10px] text-destructive">{errors["notes"]}</span>}
        </label>
        {errors["values"] && <p className="text-xs text-destructive">{errors["values"]}</p>}
        <p className="text-[11px] text-muted-foreground">فعلاً ذخیره‌سازی دائمی وصل نیست؛ با رفرش صفحه پاک می‌شود.</p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>بستن</Button>
          <Button variant="hero" onClick={save}>ثبت</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
