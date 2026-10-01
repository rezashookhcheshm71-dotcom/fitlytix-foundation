import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarCheck, HelpCircle, MessageCircle, RefreshCw, Sun } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { JOURNEY_STAGES, READINESS_LABEL, type DecisionRecommendation, type JourneyStage, type ReadinessAssessment } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Panel, Pill, ProgressRing } from "./primitives";

/** "چرا؟" — expandable, human-readable reason with the inputs it used. */
export function WhyNote({ why, inputs }: { why: string; inputs?: string[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
        <HelpCircle className="size-3.5" /> چرا؟
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-lg bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
        {why}
        {inputs && inputs.length > 0 && <div className="mt-1 text-[10px]">بر اساس: {inputs.join(" · ")}</div>}
      </CollapsibleContent>
    </Collapsible>
  );
}

const INPUT_LABEL: Record<string, string> = { athlete: "پروفایل", dna: "Fitness DNA", goal: "هدف", training: "تمرین", nutrition: "تغذیه", recovery: "ریکاوری", health: "داده سلامت", feedback: "بازخورد" };
const KIND_ICON = { today_focus: Sun, training_adjustment: RefreshCw, nutrition_context: CalendarCheck, recovery_focus: RefreshCw, next_week: ArrowLeft, attention: HelpCircle } as const;

export function CoachCards({ recs }: { recs: DecisionRecommendation[] }) {
  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="کارت‌های مربی">
      {recs.map((r) => {
        const Icon = KIND_ICON[r.kind];
        return (
          <Panel key={r.id} className={cn("flex flex-col", r.kind === "attention" && "border-warning/40")}>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icon className="size-3.5 text-primary" /> {r.title}</div>
            <p className="text-sm leading-7">{r.text}</p>
            <div className="mt-auto"><WhyNote why={r.why} inputs={r.inputs.map((i) => INPUT_LABEL[i] ?? i)} /></div>
          </Panel>
        );
      })}
      <Panel className="flex flex-col justify-between">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground"><MessageCircle className="size-3.5 text-primary" /> از مربی بپرس</div>
        <p className="text-sm leading-7 text-muted-foreground">سؤالی درباره جلسه یا تغذیه داری؟ مربی‌ات همین‌جا جواب می‌دهد.</p>
        <p className="mt-2 text-[11px] text-muted-foreground">پیام‌رسانی در نسخه بعد فعال می‌شود.</p>
      </Panel>
    </section>
  );
}

const levelColor = { ready: "var(--success)", moderate: "var(--warning)", recovery_needed: "var(--destructive)" } as const;

export function ReadinessCard({ r }: { r: ReadinessAssessment }) {
  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">آمادگی امروز</span><Pill color={levelColor[r.level]}>{READINESS_LABEL[r.level]}</Pill></div>
      <div className="flex items-center gap-4">
        <ProgressRing value={r.score} size={84} stroke={8} color={levelColor[r.level]}><span className="num text-xl font-bold">{r.score}</span></ProgressRing>
        <ul className="flex-1 space-y-1.5 text-xs">
          {r.factors.map((f) => (
            <li key={f.key + f.label} className="flex justify-between gap-2"><span className="text-muted-foreground">{f.label}</span><span className={cn("num font-semibold", f.effect === "negative" && "text-warning", f.effect === "positive" && "text-success")}>{f.value}</span></li>
          ))}
        </ul>
      </div>
      <WhyNote why={r.why} />
    </Panel>
  );
}

export function JourneyBar({ stage }: { stage: JourneyStage }) {
  const idx = JOURNEY_STAGES.findIndex((s) => s.id === stage);
  return (
    <ol className="flex items-center gap-1" aria-label="مسیر ورزشکار">
      {JOURNEY_STAGES.map((s, i) => (
        <li key={s.id} className="flex flex-1 flex-col gap-1.5" aria-current={i === idx ? "step" : undefined}>
          <div className={cn("h-1.5 rounded-full", i < idx ? "bg-primary" : i === idx ? "bg-gradient-ember" : "bg-muted")} />
          <span className={cn("text-[10px]", i === idx ? "font-bold text-foreground" : "text-muted-foreground")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function PackageNotice({ included, what }: { included: boolean; what: "training" | "nutrition" }) {
  if (included) return null;
  return (
    <Panel className="border-dashed text-center">
      <p className="text-sm font-semibold">{what === "training" ? "برنامه تمرینی در بسته فعلی‌ات نیست." : "برنامه تغذیه در بسته فعلی‌ات نیست."}</p>
      <p className="mt-1 text-xs text-muted-foreground">اگر خواستی، بسته «تمرین + تغذیه» هر دو را کنار هم دارد.</p>
      <Link to="/plans" className="mt-3 inline-flex text-xs font-semibold text-primary">دیدن بسته‌ها</Link>
    </Panel>
  );
}
