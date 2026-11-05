import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BatteryCharging,
  CalendarCheck2,
  ClipboardList,
  CreditCard,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  Move,
  PersonStanding,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, Panel, ProgressRing } from "@/components/domain/primitives";
import { CarouselSlide, type CarouselSlideItem } from "@/components/domain/carousel";
import { demoDNA, demoPerformance } from "@/mock/athlete";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitLytix — مربی‌گری و عملکرد هوشمند" },
      {
        name: "description",
        content:
          "ارزیابی رشته‌محور، Fitness DNA، برنامه تطبیقی و داده هر تمرین؛ بدون نیاز به ساعت هوشمند.",
      },
      { property: "og:title", content: "FitLytix — مربی‌گری و عملکرد هوشمند" },
      {
        property: "og:description",
        content: "ارزیابی، Fitness DNA، برنامه تطبیقی و داده؛ یک مسیر قابل اندازه‌گیری.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

// One glyph per DNA dimension, keyed by registry id.
const DNA_ICON: Record<string, typeof Dumbbell> = {
  strength: Dumbbell,
  power: Zap,
  engine: HeartPulse,
  gymnastics: PersonStanding,
  mobility: Move,
  recovery: BatteryCharging,
  consistency: CalendarCheck2,
  skill: Target,
};

// The homepage no longer explains the product in seven stacked sections. Each
// pillar gets ONE slide in a banner, with a single line and a button that leaves
// the homepage for the page that actually carries the detail. Explanation lives
// where it belongs; the homepage's job is to get the user moving.
const PILLARS: {
  id: string;
  icon: typeof Dumbbell;
  title: string;
  line: string;
  to: string;
  cta: string;
}[] = [
  {
    id: "loop",
    icon: RefreshCw,
    title: "چرخه‌ی FitLytix",
    line: "ارزیابی، برنامه، تمرین، سنجش، تطبیق — هر دور داده‌ی دور بعد را دقیق‌تر می‌کند.",
    to: "/assessment/common",
    cta: "شروع چرخه",
  },
  {
    id: "dna",
    icon: Target,
    title: "Fitness DNA",
    line: "قدرت، توان، موتور، مهارت، تحرک، ریکاوری و استمرار در یک پروفایل چندبعدی.",
    to: "/athlete/fitness-dna",
    cta: "دیدن DNA نمونه",
  },
  {
    id: "coaching",
    icon: Users,
    title: "هوش + مربی انسانی",
    line: "موتور تحلیل می‌کند و پیشنهاد می‌دهد؛ تصمیمِ حساس با مربی واقعی است.",
    to: "/plans",
    cta: "انواع مربی‌گری",
  },
  {
    id: "performance",
    icon: BarChart3,
    title: "عملکرد در متن",
    line: "روند، آمادگی، بار تمرین و PRها کنار هم — نه عددِ تنها.",
    to: "/athlete/dashboard",
    cta: "داشبورد نمونه",
  },
  {
    id: "sports",
    icon: Dumbbell,
    title: "رشته‌ی تو",
    line: "منطقِ تمرین و شاخص‌ها بر اساس رشته؛ بدون داده‌ی پایه‌ی ورزشکار از هم جدا.",
    to: "/assessment/sport",
    cta: "انتخاب رشته",
  },
];

// Three doors into the product. The homepage ends here instead of continuing
// into brochures: evaluate, look at a live dashboard, or see what it costs.
const ACTIONS = [
  {
    icon: ClipboardList,
    title: "شروع ارزیابی",
    line: "چند دقیقه، بدون ساعت هوشمند.",
    to: "/register",
  },
  {
    icon: LayoutDashboard,
    title: "داشبورد نمونه",
    line: "خودت ببین، نه اینکه بخوانی.",
    to: "/athlete/dashboard",
  },
  { icon: CreditCard, title: "پلن‌ها و قیمت", line: "شفاف، بدون تعهد پنهان.", to: "/plans" },
];

function Landing() {
  return (
    <MarketingShell>
      {/* Minimal hero: no stock photo; the product panel shows rather than tells. */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div
          className="pointer-events-none absolute -top-32 end-[-10%] size-[36rem] rounded-full bg-primary/12 blur-[120px]"
          aria-hidden
        />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
              <Activity className="size-3.5 text-primary" /> Intelligent Sports Coaching &
              Performance
            </div>
            <h1 className="text-5xl font-black leading-[1.08] tracking-tight md:text-7xl">
              بدنت را بشناس.
              <br />
              <span className="text-gradient-ember">مسیرت را بساز.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-foreground/70 md:text-lg">
              FitLytix پلتفرم هوشمند مربی‌گری و عملکرد است؛ جایی که ارزیابی، Fitness DNA، برنامه
              شخصی و داده هر تمرین، یک مسیر قابل اندازه‌گیری می‌سازند.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/register">
                  شروع ارزیابی <ArrowLeft />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/athlete/dashboard">دیدن داشبورد نمونه</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-6 bg-primary/10 blur-3xl" aria-hidden />
            <Panel glass className="relative rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{"TODAY'S READINESS"}</span>
                    <MockBadge />
                  </div>
                  <div className="num mt-1 text-3xl font-bold">
                    78 <span className="text-xs text-success">آماده</span>
                  </div>
                </div>
                <ProgressRing value={78} size={64} stroke={6} color="var(--success)">
                  <span className="num text-sm font-bold">78</span>
                </ProgressRing>
              </div>
              <div className="mt-4">
                <WeekRhythm data={demoPerformance} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {demoDNA.dimensions.slice(0, 2).map((d) => {
                  const Icon = DNA_ICON[d.id] ?? Dumbbell;
                  return (
                    <div
                      key={d.id}
                      className="group surface-sunken rounded-lg px-3 py-2.5 transition duration-300 hover:-translate-y-0.5 hover:bg-card-elevated"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 text-primary transition duration-300 group-hover:scale-110" />
                        <span className="flex-1 truncate text-xs font-semibold">{d.label}</span>
                        <span className="num text-sm font-bold">{d.score}</span>
                      </div>
                      <Bar value={d.score / 100} height={4} className="mt-2" />
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {/* The pillars as one rotating banner instead of five stacked sections. */}
      <section className="border-b border-border/60 py-14 md:py-20">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
          <CarouselSlide
            minHeight={240}
            label="بنرِ ستون‌های محصول"
            slides={PILLARS.map((p): CarouselSlideItem => {
              const Icon = p.icon;
              return {
                id: p.id,
                content: (
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center sm:p-10">
                    <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="size-6" />
                    </span>
                    <h2 className="text-2xl font-extrabold md:text-3xl">{p.title}</h2>
                    <p className="max-w-xl text-sm leading-7 text-muted-foreground">{p.line}</p>
                    <Button asChild variant="outline">
                      <Link to={p.to as never}>
                        {p.cta} <ArrowLeft className="size-4" />
                      </Link>
                    </Button>
                  </div>
                ),
              };
            })}
          />
        </div>
      </section>

      {/* Three doors. This is the homepage's whole ask. */}
      <section className="py-16 md:py-24">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 md:grid-cols-3 md:px-8">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to as never}
                className="group surface-sunken flex flex-col items-start gap-3 rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:bg-card-elevated"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition duration-300 group-hover:scale-110">
                  <Icon className="size-5" />
                </span>
                <span className="text-lg font-extrabold">{a.title}</span>
                <span className="text-xs leading-6 text-muted-foreground">{a.line}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-2 text-xs font-semibold text-primary">
                  برو{" "}
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Final nudge. */}
      <section className="px-4 pb-20 md:px-8 md:pb-28">
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center overflow-hidden rounded-lg border border-primary/25 bg-gradient-carbon px-6 py-16 text-center md:py-20">
          <div className="grid-noise absolute inset-0 opacity-35" aria-hidden />
          <ShieldCheck className="relative mb-5 size-8 text-primary" />
          <h2 className="relative text-3xl font-black md:text-5xl">
            اولین تصمیم دقیق، شناختن نقطه شروع است.
          </h2>
          <p className="relative mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            ارزیابی را شروع کن و ببین FitLytix چطور داده‌های پراکنده را به یک مسیر تمرینی قابل اجرا
            تبدیل می‌کند.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/register">
                شروع ارزیابی <ArrowLeft />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/athlete/dashboard">مشاهده محصول</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

// Eight vertical bars, one per week, scaled from that week's training load; the
// newest week is ember so the eye lands on "now". Heights normalised into a
// 20-80% band so labels fit and small differences stay visible. All derived from
// the sample series the panel labels as illustrative.
function WeekRhythm({ data }: { data: typeof demoPerformance }) {
  const vols = data.map((d) => d.volume);
  const min = Math.min(...vols);
  const max = Math.max(...vols);
  const span = max - min || 1;
  const first = data[0];
  const lastP = data[data.length - 1];
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <BarChart3 className="size-3 text-primary" /> ریتمِ بارِ تمرین · ۸ هفته
        </span>
        {first && lastP && (
          <span className="num text-[10px] font-bold text-success">
            +{lastP.performanceIndex - first.performanceIndex} شاخص
          </span>
        )}
      </div>
      <div className="flex h-24 items-end gap-1.5">
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const h = 20 + ((d.volume - min) / span) * 60;
          return (
            <div key={d.week} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <div
                className={`w-full rounded-t-md transition-all duration-300 hover:-translate-y-0.5 ${
                  isLast ? "bg-primary" : "bg-primary/25 hover:bg-primary/45"
                }`}
                style={{ height: `${h}%` }}
              />
              <span
                className={`text-center font-display text-[9px] ${
                  isLast ? "font-bold text-primary" : "text-muted-foreground"
                }`}
              >
                {d.week}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
