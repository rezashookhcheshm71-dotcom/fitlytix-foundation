/**
 * "ثبت داده" — the athlete side of the data loop.
 *
 * The recommender's thinnest signals are behavioural: did the session actually happen, how
 * hard did it feel, how did the athlete sleep, what did they eat. Without them a plan can
 * only use the assessment. Each form below writes straight to MySQL through `/api/logs`,
 * and every write re-labels the current plan's outcome, which is what `ml/train.py` later
 * learns from.
 */
import { useCallback, useEffect, useState } from "react";
import { Coffee, Dumbbell, Moon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, SectionHeading } from "@/components/domain/primitives";

type Tab = "session" | "nutrition" | "checkin";

interface LogSummary {
  sessions: {
    id: string;
    title: string;
    status: string;
    rpe: number | null;
    minutes: number | null;
  }[];
  nutrition: { id: string; description: string; calories: number | null }[];
  checkins: { date: string; sleepHours: number | null; readiness: number | null }[];
}

const TABS: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
  { id: "session", label: "تمرین", icon: Dumbbell },
  { id: "nutrition", label: "تغذیه", icon: Coffee },
  { id: "checkin", label: "چک‌این روزانه", icon: Moon },
];

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DataEntryCard({
  className,
  onSaved,
}: {
  className?: string;
  onSaved?: (() => void) | undefined;
}) {
  const [tab, setTab] = useState<Tab>("session");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogSummary | null>(null);

  const [sessionTitle, setSessionTitle] = useState("جلسهٔ تمرین");
  const [sessionMinutes, setSessionMinutes] = useState("60");
  const [sessionRpe, setSessionRpe] = useState("7");
  const [sessionDone, setSessionDone] = useState(true);

  const [mealDescription, setMealDescription] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");

  const [sleepHours, setSleepHours] = useState("7.5");
  const [stress, setStress] = useState("3");
  const [readiness, setReadiness] = useState("70");
  const [weightKg, setWeightKg] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/logs?days=14", { credentials: "same-origin" });
      if (!response.ok) return;
      const data = (await response.json()) as { ok?: boolean } & Partial<LogSummary>;
      if (data.ok) {
        setLogs({
          sessions: data.sessions ?? [],
          nutrition: data.nutrition ?? [],
          checkins: data.checkins ?? [],
        });
      }
    } catch {
      /* offline is fine — the card still works for writes */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (kind: Tab, payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, payload }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "ذخیره نشد؛ دوباره تلاش کنید.");
        return;
      }
      toast.success("ثبت شد. برنامهٔ پیشنهادی با همین داده به‌روزرسانی می‌شود.");
      await load();
      onSaved?.();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className={className}>
      <SectionHeading
        title="ثبت داده‌های امروز"
        subtitle="هر داده‌ای که ثبت شود، مستقیم در برنامهٔ تمرین و تغذیه لحاظ می‌شود"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
              tab === id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "session" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="session-title">عنوان جلسه</Label>
              <Input
                id="session-title"
                value={sessionTitle}
                onChange={(event) => setSessionTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-minutes">مدت (دقیقه)</Label>
              <Input
                id="session-minutes"
                inputMode="numeric"
                value={sessionMinutes}
                onChange={(event) => setSessionMinutes(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-rpe">شدت درک‌شده (۰ تا ۱۰)</Label>
              <Input
                id="session-rpe"
                inputMode="numeric"
                value={sessionRpe}
                onChange={(event) => setSessionRpe(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={sessionDone}
              onChange={(event) => setSessionDone(event.target.checked)}
            />
            جلسه را کامل انجام دادم (اگر تیک بردارید، به‌عنوان جلسهٔ ازدست‌رفته ثبت می‌شود)
          </label>
          <Button
            variant="hero"
            disabled={saving || sessionTitle.trim().length < 2}
            onClick={() =>
              void submit("session", {
                title: sessionTitle.trim(),
                minutes: numberOrUndefined(sessionMinutes),
                rpe: numberOrUndefined(sessionRpe),
                completed: sessionDone,
              })
            }
          >
            {saving ? "در حال ذخیره…" : "ثبت جلسه"}
          </Button>
        </div>
      ) : null}

      {tab === "nutrition" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="meal-description">وعده</Label>
              <Input
                id="meal-description"
                placeholder="مثلاً: برنج، مرغ، سالاد"
                value={mealDescription}
                onChange={(event) => setMealDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meal-calories">کالری</Label>
              <Input
                id="meal-calories"
                inputMode="numeric"
                value={mealCalories}
                onChange={(event) => setMealCalories(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meal-protein">پروتئین (گرم)</Label>
              <Input
                id="meal-protein"
                inputMode="numeric"
                value={mealProtein}
                onChange={(event) => setMealProtein(event.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            مهم‌ترین ورودی مدل، «تعداد روزهایی است که ثبت می‌کنید» — نه دقت کالری. حتی ثبت ساده کافی
            است.
          </p>
          <Button
            variant="hero"
            disabled={saving || mealDescription.trim().length < 2}
            onClick={() =>
              void submit("nutrition", {
                description: mealDescription.trim(),
                calories: numberOrUndefined(mealCalories),
                proteinG: numberOrUndefined(mealProtein),
              })
            }
          >
            {saving ? "در حال ذخیره…" : "ثبت وعده"}
          </Button>
        </div>
      ) : null}

      {tab === "checkin" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="checkin-sleep">خواب (ساعت)</Label>
              <Input
                id="checkin-sleep"
                inputMode="decimal"
                value={sleepHours}
                onChange={(event) => setSleepHours(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkin-stress">استرس (۱ تا ۵)</Label>
              <Input
                id="checkin-stress"
                inputMode="numeric"
                value={stress}
                onChange={(event) => setStress(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkin-readiness">آمادگی (۰ تا ۱۰۰)</Label>
              <Input
                id="checkin-readiness"
                inputMode="numeric"
                value={readiness}
                onChange={(event) => setReadiness(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkin-weight">وزن (کیلوگرم)</Label>
              <Input
                id="checkin-weight"
                inputMode="decimal"
                placeholder="اختیاری"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            با دو چک‌این یا بیشتر در دو هفتهٔ اخیر، خواب و آمادگیِ واقعی جای پاسخ ارزیابی را می‌گیرد
            و سقف جلسات هفتگی بر همان اساس تنظیم می‌شود.
          </p>
          <Button
            variant="hero"
            disabled={saving}
            onClick={() =>
              void submit("checkin", {
                sleepHours: numberOrUndefined(sleepHours),
                stress: numberOrUndefined(stress),
                readiness: numberOrUndefined(readiness),
                weightKg: numberOrUndefined(weightKg),
              })
            }
          >
            {saving ? "در حال ذخیره…" : "ثبت چک‌این امروز"}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        {logs ? (
          <p>
            ثبت‌شده در ۱۴ روز گذشته: {logs.sessions.length} جلسه · {logs.nutrition.length} وعده ·{" "}
            {logs.checkins.length} چک‌این
          </p>
        ) : (
          <p>در حال خواندن سابقه…</p>
        )}
        {onSaved ? (
          <button
            type="button"
            onClick={onSaved}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            به‌روزرسانی برنامه با داده‌های جدید
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
