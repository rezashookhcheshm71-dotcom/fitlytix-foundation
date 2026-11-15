/**
 * One-tap session logging for today's workout.
 *
 * The full data-entry card asks for everything; this asks for the two things the model needs
 * to know the session happened and how hard it was. Logging a missed session is just as
 * valuable — the recommender treats "planned but not done" as a real signal, not an error.
 */
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, SectionHeading } from "@/components/domain/primitives";

export function QuickSessionCard({
  title,
  estimatedMin,
  className,
  onSaved,
}: {
  title: string;
  estimatedMin?: number | undefined;
  className?: string | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const [rpe, setRpe] = useState("7");
  const [saving, setSaving] = useState(false);

  const submit = async (completed: boolean) => {
    setSaving(true);
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "session",
          payload: {
            title,
            minutes: estimatedMin,
            rpe: completed ? Number(rpe) || undefined : undefined,
            completed,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "ثبت نشد؛ دوباره تلاش کنید.");
        return;
      }
      toast.success(
        completed ? "جلسه ثبت شد. برنامه به‌روزرسانی می‌شود." : "ثبت شد؛ فردا سبک‌تر می‌شود.",
      );
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
        title="جلسهٔ امروز انجام شد؟"
        subtitle="با یک ضربه ثبت می‌شود و همان روز در برنامهٔ شما اثر می‌گذارد"
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28 space-y-1">
          <Label htmlFor="quick-rpe">شدت (RPE)</Label>
          <Input
            id="quick-rpe"
            inputMode="numeric"
            value={rpe}
            onChange={(event) => setRpe(event.target.value)}
          />
        </div>
        <Button variant="hero" disabled={saving} onClick={() => void submit(true)}>
          <CheckCircle2 className="me-1 size-4" />
          جلسه را انجام دادم
        </Button>
        <Button variant="outline" disabled={saving} onClick={() => void submit(false)}>
          <XCircle className="me-1 size-4" />
          امروز تمرین نکردم
        </Button>
        {estimatedMin ? (
          <span className="text-[11px] text-muted-foreground">
            مدت برنامه‌ریزی‌شده: {estimatedMin} دقیقه
          </span>
        ) : null}
      </div>
    </Panel>
  );
}
