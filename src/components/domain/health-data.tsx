import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Watch, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATUS_LABEL,
  HEALTH_PROVIDERS,
  METRIC_DEFS,
  PROVIDER_LABEL,
  type ConnectionStatus,
  type HealthMetricType,
  type HealthProvider,
  type WearableIntent,
} from "@/domain/types";
import { healthDataService } from "@/services/health-data/service";
import { Panel, Pill, SectionHeading } from "./primitives";

/* Assessment intake ------------------------------------------------------- */

export type WearableIntakeState = { intent?: WearableIntent | undefined; providers: HealthProvider[] };

export function WearableIntake({ state, onChange }: { state: WearableIntakeState; onChange: (s: WearableIntakeState) => void }) {
  const choices: { v: WearableIntent; l: string }[] = [
    { v: "yes", l: "بله" },
    { v: "no", l: "خیر" },
    { v: "later", l: "مطمئن نیستم / بعداً" },
  ];
  return (
    <section className="card-surface rounded-2xl p-5 md:p-6" aria-labelledby="wearable-title">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Watch className="size-5" /></span>
        <div>
          <h3 id="wearable-title" className="text-base font-bold">از ساعت یا اپ سلامت استفاده می‌کنی؟</h3>
          <p className="text-xs leading-6 text-muted-foreground">خواب، HRV و بار تمرین کمک می‌کند شدت جلسه‌ها را بهتر با حال واقعی بدنت تنظیم کنیم. اتصال بعداً از داشبورد انجام می‌شود.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="استفاده از ساعت هوشمند">
        {choices.map((c) => (
          <Button key={c.v} type="button" role="radio" aria-checked={state.intent === c.v} size="sm" variant={state.intent === c.v ? "default" : "outline"} onClick={() => onChange({ ...state, intent: c.v })}>{c.l}</Button>
        ))}
      </div>
      {state.intent === "yes" && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold">از کدام استفاده می‌کنی؟</div>
          <div className="flex flex-wrap gap-1.5">
            {HEALTH_PROVIDERS.map((p) => {
              const on = state.providers.includes(p);
              return (
                <Button key={p} type="button" size="sm" variant="outline" aria-pressed={on} onClick={() => onChange({ ...state, providers: on ? state.providers.filter((x) => x !== p) : [...state.providers, p] })}
                  className={cn("h-auto min-h-8 rounded-lg px-3 py-1.5 text-xs", on ? "border-primary bg-primary-soft text-primary" : "bg-muted/40 text-muted-foreground")}>
                  {PROVIDER_LABEL[p]}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

/* Dashboard panel --------------------------------------------------------- */

const statusColor: Record<ConnectionStatus, string> = {
  not_connected: "var(--muted-foreground)",
  ready_to_connect: "var(--info)",
  connected: "var(--success)",
  sync_error: "var(--destructive)",
  manual: "var(--primary)",
};

export function HealthDataPanel({ athleteId, empty, version, onChanged }: { athleteId: string; empty?: boolean; version: number; onChanged: () => void }) {
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  void version;
  const connections = empty ? [] : healthDataService.listConnections(athleteId);
  const latest = empty ? {} : healthDataService.latestByType(athleteId);
  const keys = Object.keys(latest) as HealthMetricType[];
  const status: ConnectionStatus = empty ? "not_connected" : healthDataService.overallStatus(athleteId);

  return (
    <Panel className="mb-6">
      <SectionHeading title="دستگاه‌ها و داده‌های سلامت" subtitle="ساعت، اپ سلامت یا ورود دستی" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill color={statusColor[status]}>{CONNECTION_STATUS_LABEL[status]}</Pill>
        <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}><Plus /> ورود دستی</Button>
        <Link to="/athlete/health" className="text-xs font-semibold text-primary">جزئیات</Link>
      </div>

      {connections.length > 0 && (
        <ul className="mb-4 divide-y divide-border/60 rounded-xl bg-muted/30">
          {connections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <div className="text-sm font-semibold">{PROVIDER_LABEL[c.provider]}</div>
                <div className="text-[11px] text-muted-foreground">آخرین همگام‌سازی: {c.lastSyncAt ?? "هنوز همگام‌سازی نشده"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Pill color={statusColor[c.status]}>{CONNECTION_STATUS_LABEL[c.status]}</Pill>
                <Button size="sm" variant="ghost" onClick={() => setNotice(healthDataService.requestConnect(c.provider).message)}><Link2 /> اتصال</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {notice && <p role="status" className="mb-4 rounded-lg bg-info/10 p-3 text-xs leading-6 text-info">{notice}</p>}

      {keys.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {keys.map((k) => (
            <div key={k} className="rounded-xl bg-muted/40 p-3">
              <div className="text-[11px] text-muted-foreground">{METRIC_DEFS[k].label}</div>
              <div className="num mt-1 text-lg font-bold">{latest[k]!.value.toLocaleString("en-US")} <span className="text-[10px] font-normal text-muted-foreground">{latest[k]!.unit}</span></div>
              <div className="text-[10px] text-muted-foreground">{latest[k]!.source === "manual" ? "دستی" : PROVIDER_LABEL[latest[k]!.source]} · {latest[k]!.startTime.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-5 text-center">
          <p className="text-sm font-semibold">هنوز داده سلامتی ثبت نشده.</p>
          <p className="mt-1 text-xs text-muted-foreground">ساعت نداری؟ مشکلی نیست؛ خواب و ضربان استراحت را دستی وارد کن.</p>
        </div>
      )}
      <ManualHealthDialog open={manualOpen} onOpenChange={setManualOpen} athleteId={athleteId} onSaved={onChanged} />
    </Panel>
  );
}

export function ManualHealthDialog({ open, onOpenChange, athleteId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; athleteId: string; onSaved: () => void }) {
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [vals, setVals] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const values = Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)]));
    const parsed = healthDataService.validateManual({ measuredAt, values });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path.at(-1)), i.message])));
      return;
    }
    healthDataService.addManual(athleteId, parsed.data);
    setVals({}); setErrors({}); onOpenChange(false); onSaved();
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
          {(Object.keys(METRIC_DEFS) as HealthMetricType[]).map((k) => (
            <label key={k} className="text-xs font-semibold">
              <span className="flex justify-between">{METRIC_DEFS[k].label}<span className="font-mono text-[10px] text-muted-foreground">{METRIC_DEFS[k].unit}</span></span>
              <Input dir="ltr" inputMode="decimal" value={vals[k] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} aria-invalid={Boolean(errors[k])} className="mt-1 bg-muted/40 font-mono" placeholder="—" />
              {errors[k] && <span className="mt-1 block text-[10px] text-destructive">{errors[k]}</span>}
            </label>
          ))}
        </div>
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
