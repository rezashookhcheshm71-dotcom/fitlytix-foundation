/**
 * «تغییر برنامه» — the one place where the athlete can actually make the plan different.
 *
 * The engine is deterministic: identical inputs give an identical plan (which is what makes the
 * stored plan reproducible). So a bare "regenerate" button can only ever return the same plan,
 * which reads as "the AI is broken". This control changes real constraints the engine honours —
 * cycle length and sessions per week — and then reports the diff, including the honest case where
 * nothing changed.
 */
import { useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/domain/primitives";
import type { PlanDurationMonths } from "@/domain/recommendation";
import type { UsePlanResult } from "@/hooks/use-plan";
import { faNumber } from "@/lib/locale";

const DURATIONS: { value: PlanDurationMonths | "auto"; labelFa: string }[] = [
  { value: "auto", labelFa: "خودکار" },
  { value: 1, labelFa: "۱ ماه" },
  { value: 3, labelFa: "۳ ماه" },
  { value: 6, labelFa: "۶ ماه" },
  { value: 12, labelFa: "۱۲ ماه" },
];

const SESSIONS: (number | "auto")[] = ["auto", 2, 3, 4, 5, 6];

export function PlanControls({ plan }: { plan: UsePlanResult }) {
  const [duration, setDuration] = useState<PlanDurationMonths | "auto">("auto");
  const [sessions, setSessions] = useState<number | "auto">("auto");

  const apply = () =>
    void plan.refresh({
      durationMonths: duration,
      ...(sessions === "auto" ? {} : { maxSessionsPerWeek: sessions }),
    });

  const change = plan.lastChange;
  const requestedSomething = duration !== "auto" || sessions !== "auto";

  return (
    <Panel className="mt-3 bg-muted/30">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden />
        <span className="text-sm font-bold">تغییر برنامه</span>
      </div>

      <p className="mb-3 text-[11px] leading-6 text-muted-foreground">
        برنامه از ورودی‌های شما محاسبه می‌شود؛ با همان ورودی‌ها همیشه همان برنامه ساخته می‌شود. برای
        دیدن برنامهٔ متفاوت، یکی از این دو را عوض کنید — یا دادهٔ جدید ثبت کنید تا ورودی‌ها عوض
        شوند.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted-foreground">طول دوره</span>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={String(duration)}
            onChange={(event) => {
              const value = event.target.value;
              setDuration(value === "auto" ? "auto" : (Number(value) as PlanDurationMonths));
            }}
          >
            {DURATIONS.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.labelFa}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted-foreground">حداکثر جلسه در هفته</span>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={String(sessions)}
            onChange={(event) => {
              const value = event.target.value;
              setSessions(value === "auto" ? "auto" : Number(value));
            }}
          >
            {SESSIONS.map((option) => (
              <option key={String(option)} value={String(option)}>
                {option === "auto" ? "خودکار" : `${faNumber(option)} جلسه`}
              </option>
            ))}
          </select>
        </label>

        <Button size="sm" onClick={apply} disabled={plan.refreshing}>
          {plan.refreshing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> در حال ساخت…
            </>
          ) : (
            "اعمال و ساخت برنامه"
          )}
        </Button>
      </div>

      <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
        «حداکثر جلسه» فقط می‌تواند تعداد را کم کند؛ اگر مدل خودش ۴ جلسه داده باشد، انتخاب ۶ چیزی را
        عوض نمی‌کند.
      </p>

      {change && !plan.refreshing && (
        <div className="mt-3 rounded-lg bg-background/70 p-3 text-xs leading-6">
          {change.changes.length > 0 ? (
            <>
              <div className="font-semibold text-success">برنامه عوض شد:</div>
              <ul className="mt-1 space-y-0.5">
                {change.changes.map((item) => (
                  <li key={item.labelFa} className="num">
                    {item.labelFa}: <span className="text-muted-foreground">{item.fromFa}</span> →{" "}
                    <span className="font-semibold">{item.toFa}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="font-semibold">برنامه عوض نشد.</div>
              <p className="mt-1 text-muted-foreground">
                {requestedSomething
                  ? "این تنظیم‌ها همان چیزی را می‌دهند که دارید؛ مدل همان ورودی‌ها را همان‌طور می‌خواند. تنش را با عدد دیگری امتحان کنید یا یک جلسه/چک‌این ثبت کنید تا ورودی‌ها عوض شوند."
                  : "هیچ تنظیمی عوض نکردید. یکی از دو گزینهٔ بالا را تغییر دهید، یا دادهٔ جدید ثبت کنید."}
              </p>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
