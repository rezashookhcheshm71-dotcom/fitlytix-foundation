import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { demoPlans, formatIRR } from "@/mock/plans";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "پلن‌ها — FitLytix" },
      { name: "description", content: "AI Coach، Hybrid یا مربی انسانی؛ پلن پیشنهادی بر اساس ارزیابی و Fitness DNA." },
      { property: "og:title", content: "پلن‌ها — FitLytix" },
      { property: "og:description", content: "AI Coach، Hybrid یا مربی انسانی؛ پلن پیشنهادی بر اساس Fitness DNA." },
    ],
  }),
  component: Plans,
});

function Plans() {
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
        <PageHeader eyebrow="COACHING TYPE → PLAN" title="نوع مربی‌گری خود را انتخاب کنید" description="بر اساس Fitness DNA و هدف Snatch ۹۰ کیلو، پلن Hybrid پیشنهاد می‌شود." actions={<MockBadge label="قیمت‌ها نمایشی" />} />
        <div className="grid gap-4 lg:grid-cols-3">
          {demoPlans.map((p) => (
            <Panel key={p.id} className={`relative flex flex-col ${p.highlight ? "shadow-glow-lg ring-1 ring-primary/50" : ""}`}>
              {p.badge && <Pill color="var(--primary)" className="absolute -top-3 start-5">{p.badge}</Pill>}
              <div className="font-display text-xl font-bold">{p.name}</div>
              <div className="mt-3 text-2xl font-extrabold">{formatIRR(p.priceMonthly)} <span className="text-xs font-normal text-muted-foreground">/ ماه</span></div>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{f}</li>)}
              </ul>
              <Button asChild variant={p.highlight ? "hero" : "outline"} size="lg" className="mt-6">
                <Link to="/checkout" search={{ plan: p.id }}>انتخاب {p.name}</Link>
              </Button>
            </Panel>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
