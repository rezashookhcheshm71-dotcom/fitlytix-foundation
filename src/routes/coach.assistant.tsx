import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardEdit, Dumbbell, Salad, XCircle } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MockBadge, PageHeader, Panel, Pill, SectionHeading } from "@/components/domain/primitives";
import { EXPERIENCE_LABEL, SPORTS } from "@/domain/sports";
import { PROPOSAL_STATUS_LABEL, type AIProposal } from "@/domain/types";
import { coachRoster } from "@/mock/coach";
import { proposalService } from "@/services/ai-coaching/proposals";

export const Route = createFileRoute("/coach/assistant")({
  validateSearch: (s) => z.object({ athlete: z.string().optional() }).parse(s),
  head: () => ({ meta: [
    { title: "دستیار مربی — FitLytix" },
    { name: "description", content: "پیش‌نویس برنامه تمرین و تغذیه از روی پروفایل ورزشکار، برای بررسی و تأیید مربی." },
    { property: "og:title", content: "دستیار مربی — FitLytix" },
    { property: "og:description", content: "پیش‌نویس برنامه تمرین و تغذیه برای بررسی و تأیید مربی." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AssistantPage,
});

const statusColor = { draft: "var(--muted-foreground)", needs_review: "var(--warning)", approved: "var(--success)", rejected: "var(--destructive)" } as const;
const CONTEXT_LABEL: Record<string, string> = { athlete: "پروفایل", dna: "Fitness DNA", goal: "هدف", training: "تمرین", nutrition: "تغذیه", recovery: "ریکاوری", health: "سلامت", feedback: "بازخورد" };

function AssistantPage() {
  const { athlete: initial } = Route.useSearch();
  const [athleteId, setAthleteId] = useState(initial ?? coachRoster[0]!.athlete.id);
  const a = coachRoster.find((r) => r.athlete.id === athleteId) ?? coachRoster[0]!;
  const [kind, setKind] = useState<"training" | "nutrition">("training");
  const [goal, setGoal] = useState(a.goal ?? "");
  const [proposal, setProposal] = useState<AIProposal | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const p = await proposalService.create(kind, a, goal || a.goal || "هدف عمومی");
    setProposal({ ...p }); setEditing(false); setLoading(false);
  };
  const refresh = (p?: AIProposal) => p && setProposal({ ...p, sections: p.sections.map((s) => ({ ...s, lines: [...s.lines] })) });

  return (
    <AppShell mode="coach" userName="سارا موسوی" userRole="مربی">
      <PageHeader eyebrow="دستیار مربی" title="پیش‌نویس بساز، تو تصمیم بگیر" description="پیش‌نویس از روی پروفایل، هدف و ریکاوری ورزشکار ساخته می‌شود. تا تأیید تو، هیچ چیزی برای ورزشکار ارسال نمی‌شود." actions={<MockBadge label="موتور نمایشی · مدل واقعی متصل نیست" />} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="space-y-4 self-start">
          <div><div className="mb-1.5 text-xs font-semibold">۱. ورزشکار</div>
            <select value={athleteId} onChange={(e) => { setAthleteId(e.target.value); const n = coachRoster.find((r) => r.athlete.id === e.target.value); setGoal(n?.goal ?? ""); setProposal(null); }} className="h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm" aria-label="انتخاب ورزشکار">
              {coachRoster.map((r) => <option key={r.athlete.id} value={r.athlete.id}>{r.athlete.identity.firstName} {r.athlete.identity.lastName} · {SPORTS[r.athlete.primarySport].name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">{EXPERIENCE_LABEL[a.athlete.experience]} · آمادگی {a.readiness} · پایبندی {Math.round(a.adherence * 100)}٪</p>
          </div>
          <div><div className="mb-1.5 text-xs font-semibold">۲. نوع پیشنهاد</div>
            <div className="grid grid-cols-2 gap-2"><Button variant={kind === "training" ? "default" : "outline"} onClick={() => setKind("training")}><Dumbbell /> تمرین</Button><Button variant={kind === "nutrition" ? "default" : "outline"} onClick={() => setKind("nutrition")}><Salad /> تغذیه</Button></div>
          </div>
          <label className="block text-xs font-semibold">۳. هدف / زمینه<Input value={goal} onChange={(e) => setGoal(e.target.value)} className="mt-1.5 bg-muted/40" /></label>
          <Button variant="hero" className="w-full" onClick={generate} disabled={loading}>{loading ? "در حال ساخت…" : "ساخت پیش‌نویس"}</Button>
        </Panel>

        {!proposal ? (
          <Panel className="flex min-h-64 flex-col items-center justify-center text-center"><ClipboardEdit className="mb-3 size-8 text-muted-foreground" /><p className="text-sm font-semibold">هنوز پیش‌نویسی ساخته نشده.</p><p className="mt-1 text-xs text-muted-foreground">ورزشکار و هدف را انتخاب کن تا یک پیشنهاد اولیه برای بررسی آماده شود.</p></Panel>
        ) : (
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-bold">{proposal.kind === "training" ? "برنامه تمرینی پیشنهادی" : "ساختار تغذیه پیشنهادی"}</h2><p className="text-xs text-muted-foreground">{a.athlete.identity.firstName} · {proposal.goal}</p></div>
              <Pill color={statusColor[proposal.status]}>{PROPOSAL_STATUS_LABEL[proposal.status]}</Pill>
            </div>
            <div className="space-y-3">{proposal.sections.map((s, si) => (
              <div key={s.id} className="rounded-xl bg-muted/40 p-3">
                <div className="mb-1 text-sm font-bold">{s.title}</div>
                {editing ? <Textarea value={s.lines.join("\n")} onChange={(e) => { const sections = proposal.sections.map((x, i) => (i === si ? { ...x, lines: e.target.value.split("\n") } : x)); setProposal({ ...proposal, sections }); }} className="min-h-20 bg-background/60 text-sm" aria-label={`ویرایش ${s.title}`} />
                  : <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
              </div>
            ))}</div>
            <SectionHeading className="mt-5" title="چرا این پیشنهاد؟" />
            <ul className="space-y-1 text-xs text-muted-foreground">{proposal.rationale.map((r) => <li key={r}>• {r}</li>)}</ul>
            <div className="mt-2 flex flex-wrap gap-1">{proposal.sourceContext.map((c) => <Pill key={c}>{CONTEXT_LABEL[c]}</Pill>)}</div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-4">
              {proposal.status === "needs_review" && <>
                {editing ? <Button variant="outline" onClick={() => { refresh(proposalService.updateSections(proposal.id, proposal.sections)); setEditing(false); }}>پایان ویرایش</Button> : <Button variant="outline" onClick={() => setEditing(true)}><ClipboardEdit /> ویرایش</Button>}
                <Button variant="hero" disabled={editing} onClick={() => refresh(proposalService.setStatus(proposal.id, "approved"))}><CheckCircle2 /> تأیید و تبدیل به برنامه من</Button>
                <Button variant="ghost" onClick={() => refresh(proposalService.setStatus(proposal.id, "rejected"))}><XCircle /> رد</Button>
              </>}
              {proposal.status === "approved" && <p className="text-sm text-success">این برنامه حالا متعلق به توست و در نسخه کامل برای ورزشکار ارسال می‌شود. (فعلاً ارسال و ذخیره دائمی وصل نیست.)</p>}
              {proposal.status === "rejected" && <p className="text-sm text-muted-foreground">پیش‌نویس کنار گذاشته شد. می‌توانی دوباره بسازی.</p>}
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
