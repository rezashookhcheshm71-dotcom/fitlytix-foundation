import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Brain, ClipboardList, CreditCard, Dna, Trophy } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/domain/primitives";
import { SportCard } from "@/components/domain/sport";
import { SPORT_LIST } from "@/domain/sports";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "شروع مسیر — FitLytix" },
      { name: "description", content: "از ارزیابی تا برنامه شخصی: مسیر ورود به FitLytix." },
      { property: "og:title", content: "شروع مسیر — FitLytix" },
      { property: "og:description", content: "از ارزیابی تا برنامه شخصی: مسیر ورود به FitLytix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const steps = [
  { icon: ClipboardList, title: "ارزیابی عمومی", desc: "پروفایل، هدف، سلامت", to: "/assessment/common" as const },
  { icon: Trophy, title: "ارزیابی رشته", desc: "بخش‌های اختصاصی ورزش شما", to: "/assessment/sport" as const },
  { icon: Dna, title: "Fitness DNA", desc: "پروفایل چندبعدی", to: "/athlete/fitness-dna" as const },
  { icon: Brain, title: "پیشنهاد پلن", desc: "AI یا مربی انسانی", to: "/plans" as const },
  { icon: CreditCard, title: "عضویت", desc: "پرداخت و شروع", to: "/checkout" as const },
];

function Onboarding() {
  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
        <PageHeader
          eyebrow="ONBOARDING"
          title="مسیر شما تا اولین برنامه شخصی"
          description="پنج قدم. هر قدم داده‌ای می‌سازد که موتور مربی‌گری برای طراحی برنامه از آن استفاده می‌کند."
          actions={
            <Button asChild variant="hero" size="lg">
              <Link to="/assessment/common">شروع ارزیابی عمومی <ArrowLeft /></Link>
            </Button>
          }
        />

        <ol className="grid gap-3 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link to={s.to} className="block h-full">
                <Panel className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/30" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><s.icon className="size-4" /></span>
                    <span className="num text-xs font-bold text-muted-foreground">0{i + 1}</span>
                  </div>
                  <div className="text-sm font-bold">{s.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.desc}</div>
                </Panel>
              </Link>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-14 text-lg font-bold">رشته‌های پشتیبانی‌شده</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SPORT_LIST.map((s) => (
            <Link key={s.id} to="/assessment/sport" search={{ sport: s.id }} className="block">
              <SportCard sport={s} />
            </Link>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
