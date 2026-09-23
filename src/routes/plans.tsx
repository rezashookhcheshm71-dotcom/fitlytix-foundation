import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Brain, Check, Sparkles, UserRound } from "lucide-react";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { demoPlans, formatIRR } from "@/mock/plans";

export const Route = createFileRoute("/plans")({
  validateSearch: (s) => z.object({ coaching: z.enum(["ai", "human", "hybrid"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "پلن‌ها — FitLytix" },
      { name: "description", content: "AI Coach، Hybrid یا مربی انسانی؛ پلن پیشنهادی بر اساس ارزیابی و Fitness DNA." },
      { property: "og:title", content: "پلن‌ها — FitLytix" },
      { property: "og:description", content: "AI Coach، Hybrid یا مربی انسانی؛ پلن پیشنهادی بر اساس Fitness DNA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plans,
});

function Plans() {
  const navigate = useNavigate();
  const { coaching = "hybrid" } = Route.useSearch();
  const coachingOptions = [
    { id: "ai" as const, icon: Brain, title: "AI Coach", desc: "تحلیل و تطبیق خودکار برنامه" },
    { id: "human" as const, icon: UserRound, title: "Human Coach", desc: "برنامه‌ریزی با مربی اختصاصی" },
    { id: "hybrid" as const, icon: Sparkles, title: "Hybrid", desc: "موتور هوشمند + بازبینی مربی" },
  ];
  const suggested = coaching === "ai" ? "plan_ai" : coaching === "human" ? "plan_human" : "plan_hybrid";
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
        <PageHeader eyebrow="COACHING TYPE → SUGGESTED PLAN" title="چطور می‌خواهید مربی‌گری شوید؟" description="نوع همراهی را انتخاب کنید. پیشنهاد FitLytix با داده ارزیابی و هدف‌های شما هماهنگ می‌شود." actions={<MockBadge label="پیشنهاد و قیمت‌ها نمایشی" />} />
        <div className="mb-10 grid gap-3 md:grid-cols-3">
          {coachingOptions.map((option) => <Button key={option.id} variant="outline" className={`h-auto justify-start whitespace-normal rounded-lg p-4 text-start ${coaching === option.id ? "border-primary bg-primary-soft" : ""}`} onClick={() => navigate({ to: "/plans", search: { coaching: option.id }, replace: true })}><option.icon className="size-5 text-primary" /><span><span className="block font-display font-bold">{option.title}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{option.desc}</span></span></Button>)}
        </div>
        <div className="mb-7 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-sm"><Sparkles className="size-4 shrink-0 text-primary" /><span>پیشنهاد بر اساس Fitness DNA «موتور قدرتی» و هدف Snatch ۹۰ کیلو: <strong>{demoPlans.find((p) => p.id === suggested)?.name}</strong></span></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {demoPlans.map((p) => (
            <Panel key={p.id} className={`relative flex flex-col rounded-lg ${p.id === suggested ? "shadow-glow-lg ring-1 ring-primary/50" : ""}`}>
              {p.id === suggested && <Pill color="var(--primary)" className="absolute -top-3 start-5">پیشنهاد برای شما</Pill>}
              <div className="font-display text-xl font-bold">{p.name}</div>
              <div className="mt-3 text-2xl font-extrabold">{formatIRR(p.priceMonthly)} <span className="text-xs font-normal text-muted-foreground">/ ماه</span></div>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{f}</li>)}
              </ul>
              <Button asChild variant={p.id === suggested ? "hero" : "outline"} size="lg" className="mt-6">
                <Link to="/checkout" search={{ plan: p.id }}>انتخاب {p.name}</Link>
              </Button>
            </Panel>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
