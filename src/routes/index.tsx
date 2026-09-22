import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Brain, Dna, LineChart, Users } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { MockBadge, Panel, ProgressRing, Stat } from "@/components/domain/primitives";
import { DnaRadarChart, PerformanceTrendChart } from "@/components/domain/charts";
import { SportBadge } from "@/components/domain/sport";
import { SPORT_LIST } from "@/domain/sports";
import { demoDNA, demoPerformance, demoRecovery } from "@/mock/athlete";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitLytix — مربی‌گری هوشمند برای ورزشکاران جدی" },
      { name: "description", content: "ارزیابی، Fitness DNA، برنامه شخصی و حلقه عملکرد در یک پلتفرم؛ برای کراس‌فیت، هایراکس، فانکشنال، بدنسازی و دویدن." },
      { property: "og:title", content: "FitLytix — مربی‌گری هوشمند برای ورزشکاران جدی" },
      { property: "og:description", content: "ورزشکار، مربی و موتور هوش مصنوعی روی یک لایه داده عملکردی." },
    ],
  }),
  component: Landing,
});

const pillars = [
  { icon: Dna, title: "Fitness DNA", desc: "ارزیابی عمومی و اختصاصی هر رشته به یک پروفایل چندبعدی تبدیل می‌شود." },
  { icon: Brain, title: "AI Coaching Engine", desc: "برنامه بر پایه DNA، هدف، تجربه و تاریخچه عملکرد ساخته و هر هفته تنظیم می‌شود." },
  { icon: LineChart, title: "Performance Loop", desc: "تمرین ← بازخورد ← داده ← ریکاوری ← تحلیل ← اصلاح برنامه." },
  { icon: Users, title: "Coach Command Center", desc: "مربی انسانی روی همان داده‌ها کار می‌کند؛ نه در یک پنل جدا." },
];

function Landing() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-20 pt-16 md:px-8 md:pt-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="animate-rise">
            <MockBadge label="Preview build · بدون اتصال به سرویس زنده" className="mb-5" />
            <h1 className="text-4xl font-black leading-[1.15] tracking-tight md:text-6xl">
              مربی‌گری هوشمند برای
              <br />
              <span className="text-gradient-ember">ورزشکارانی که جدی‌اند.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
              FitLytix ورزشکار، مربی انسانی و موتور هوش مصنوعی را روی یک لایه داده عملکردی مشترک قرار می‌دهد.
              از ارزیابی تا برنامه شخصی، از هر جلسه تا اصلاح هفتگی.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/onboarding">
                  شروع ارزیابی <ArrowLeft />
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link to="/athlete/dashboard">مشاهده داشبورد نمونه</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {SPORT_LIST.map((s) => (
                <SportBadge key={s.id} sport={s} />
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative animate-rise [animation-delay:150ms]">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-ember opacity-20 blur-3xl" />
            <Panel glass className="relative rounded-3xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">Performance Index · 8 هفته</div>
                  <div className="num text-3xl font-bold">75 <span className="text-sm text-success">+14</span></div>
                </div>
                <ProgressRing value={demoRecovery.readiness} size={64} stroke={6} color="var(--success)">
                  <span className="num text-sm font-bold">{demoRecovery.readiness}</span>
                  <span className="text-[9px] text-muted-foreground">آمادگی</span>
                </ProgressRing>
              </div>
              <PerformanceTrendChart data={demoPerformance} height={170} />
              <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl bg-card/70 p-4">
                <div>
                  <div className="text-[11px] text-muted-foreground">Fitness DNA</div>
                  <div className="font-bold">{demoDNA.archetype} <span className="font-display text-xs text-muted-foreground">{demoDNA.archetypeEn}</span></div>
                  <div className="mt-2 flex gap-4">
                    {demoDNA.dimensions.slice(0, 3).map((d) => (
                      <Stat key={d.id} label={d.labelEn} value={d.score} />
                    ))}
                  </div>
                </div>
                <div className="w-32">
                  <DnaRadarChart dimensions={demoDNA.dimensions} height={128} compact />
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <Panel key={p.title} className="animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <p.icon className="size-5" />
              </span>
              <h3 className="font-display text-base font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.desc}</p>
            </Panel>
          ))}
        </div>

        {/* Flow strip */}
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card/60 p-4">
          <ol className="flex min-w-max items-center gap-2 font-display text-xs font-semibold" dir="ltr">
            {["Assessment", "Profile", "Fitness DNA", "Goal", "Sport", "Experience", "History", "AI Engine", "Program"].map((s, i, arr) => (
              <li key={s} className="flex items-center gap-2">
                <span className={i === 7 ? "rounded-lg bg-primary px-3 py-1.5 text-primary-foreground shadow-glow" : "rounded-lg bg-muted px-3 py-1.5 text-foreground"}>{s}</span>
                {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-gradient-carbon p-10 text-center ring-1 ring-border">
          <h2 className="text-2xl font-extrabold md:text-3xl">ورزشکاری یا مربی؟</h2>
          <p className="max-w-lg text-sm text-muted-foreground">هر دو روی یک داده کار می‌کنید. نسخه نمایشی هر دو نما را ببینید.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/athlete/dashboard">نمای ورزشکار</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/coach">Coach Command Center</Link></Button>
            <Button asChild variant="ghost" size="lg"><Link to="/plans">پلن‌ها</Link></Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
