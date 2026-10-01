import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { AthleteCard } from "@/components/domain/athlete";
import { MockBadge, PageHeader, Panel, SectionHeading, Stat } from "@/components/domain/primitives";
import { coachRoster, demoCoach } from "@/mock/coach";
import { coachService } from "@/services/coach/service";
import { proposalService } from "@/services/ai-coaching/proposals";

export const Route = createFileRoute("/coach/")({
  head: () => ({
    meta: [
      { title: "مرکز فرمان مربی — FitLytix" },
      { name: "description", content: "خلاصه تیم، ورزشکاران نیازمند توجه، گزارش هفتگی و پیش‌نویس‌های در انتظار بررسی." },
      { property: "og:title", content: "مرکز فرمان مربی — FitLytix" },
      { property: "og:description", content: "خلاصه تیم، ورزشکاران نیازمند توجه و گزارش هفتگی مربی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachHome,
});

function CoachHome() {
  const brief = coachService.weeklyBrief();
  const sessionsToday = coachRoster.filter((r) => r.lastSession === "امروز").length;
  const pending = proposalService.list().filter((p) => p.status === "needs_review").length;
  const top = coachService.sort(coachRoster, "all").slice(0, 3);

  return (
    <AppShell mode="coach" userName={`${demoCoach.identity.firstName} ${demoCoach.identity.lastName}`} userRole="مربی · CrossFit L2">
      <PageHeader eyebrow="مرکز فرمان" title={`صبح بخیر، ${demoCoach.identity.firstName}`} description="اول موارد نیازمند توجه، بعد بقیه تیم." actions={<MockBadge label="روستر نمایشی" />} />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Panel><Stat label="کل ورزشکاران" value={coachRoster.length} /></Panel>
        <Panel><Stat label="فعال این هفته" value={brief.activeAthletes} tone="success" /></Panel>
        <Panel><Stat label="نیاز به توجه" value={new Set(brief.attention.filter((a) => a.severity === "act").map((a) => a.athleteId)).size} tone="warning" /></Panel>
        <Panel><Stat label="جلسه‌های امروز" value={sessionsToday} tone="info" /></Panel>
        <Panel><Stat label="نگرانی ریکاوری" value={brief.recoveryConcerns.length} /></Panel>
        <Panel><Stat label="پیش‌نویس در انتظار" value={pending} tone="primary" /></Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <SectionHeading title="گزارش هفتگی" subtitle={`میانگین پایبندی ${Math.round(brief.avgAdherence * 100)}٪`} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-success"><TrendingUp className="size-3.5" /> پیشرفت‌ها</div><ul className="space-y-1.5 text-sm">{brief.improvements.map((i) => <li key={i.athleteName}><span className="font-semibold">{i.athleteName}</span> <span className="text-xs text-muted-foreground">{i.text}</span></li>)}</ul></div>
            <div><div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-warning"><AlertTriangle className="size-3.5" /> ریکاوری و تغذیه</div><ul className="space-y-1.5 text-xs text-muted-foreground">{[...brief.recoveryConcerns, ...brief.nutritionFlags.map((n) => `تغذیه: ${n}`)].map((t) => <li key={t}>{t}</li>)}</ul></div>
          </div>
          <div className="mt-4 rounded-xl bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-bold"><Sparkles className="size-3.5 text-primary" /> پیگیری‌های پیشنهادی <span className="font-normal text-muted-foreground">(پیشنهاد — تصمیم با تو)</span></div>
            <ul className="space-y-1 text-xs">{brief.followUps.map((f) => <li key={f}>• {f}</li>)}</ul>
          </div>
        </Panel>
        <Panel className="flex flex-col">
          <SectionHeading title="دستیار مربی" subtitle="پیش‌نویس تمرین و تغذیه" />
          <p className="text-sm leading-7 text-muted-foreground">از روی پروفایل ورزشکار یک پیش‌نویس بساز، ویرایش کن و فقط وقتی راضی بودی تأیید کن.</p>
          <Button asChild variant="hero" className="mt-auto"><Link to="/coach/assistant">شروع پیش‌نویس <ArrowLeft /></Link></Button>
        </Panel>
      </div>

      <SectionHeading title="اولویت امروز" subtitle="ورزشکاران با بیشترین نیاز به پیگیری" action={{ label: "همه ورزشکاران", to: "/coach/athletes" }} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{top.map((r) => <AthleteCard key={r.athlete.id} item={r} />)}</div>
    </AppShell>
  );
}
