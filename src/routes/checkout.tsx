import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Lock } from "lucide-react";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader, Panel } from "@/components/domain/primitives";
import { commerceService } from "@/services/commerce/service";
import { demoPlans, formatIRR } from "@/mock/plans";

export const Route = createFileRoute("/checkout")({
  validateSearch: (s) => z.object({ plan: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "پرداخت و عضویت — FitLytix" },
      { name: "description", content: "تکمیل عضویت FitLytix (درگاه پرداخت هنوز متصل نیست)." },
      { property: "og:title", content: "پرداخت و عضویت — FitLytix" },
      { property: "og:description", content: "تکمیل عضویت FitLytix." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { plan: planId } = Route.useSearch();
  const navigate = useNavigate();
  const plan = demoPlans.find((p) => p.id === planId) ?? demoPlans[1];
  const [done, setDone] = useState(false);

  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8">
        <PageHeader eyebrow="SUBSCRIPTION → PAYMENT → MEMBERSHIP" title="تکمیل عضویت" actions={<MockBadge label="پرداخت شبیه‌سازی‌شده — بدون درگاه" />} />
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <Panel>
            {done ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="mb-3 size-12 text-success" />
                <h2 className="text-xl font-extrabold">عضویت آزمایشی فعال شد</h2>
                <p className="mt-1 text-sm text-muted-foreground">این یک تراکنش نمایشی بود. هیچ مبلغی برداشت نشد.</p>
                <Button variant="hero" size="lg" className="mt-6" onClick={() => navigate({ to: "/athlete/dashboard" })}>ورود به داشبورد</Button>
              </div>
            ) : (
              <>
                <h2 className="font-bold">اطلاعات پرداخت</h2>
                <p className="mt-1 text-xs text-muted-foreground">TODO(backend): اتصال درگاه پرداخت از طریق سرور. فرم زیر غیرفعال است.</p>
                <div className="mt-4 space-y-3 opacity-60">
                  {["شماره کارت", "تاریخ انقضا", "CVV2"].map((l) => (
                    <div key={l} className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">{l}</div>
                  ))}
                </div>
                <Button variant="hero" size="lg" className="mt-6 w-full" onClick={async () => { await commerceService.createMockCheckout(plan.id); setDone(true); }}>
                  <Lock /> شروع دوره آزمایشی (نمایشی)
                </Button>
              </>
            )}
          </Panel>
          <Panel glass className="self-start">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Selected Plan</div>
            <div className="mt-1 font-display text-xl font-bold">{plan.name}</div>
            <div className="mt-2 text-lg font-extrabold">{formatIRR(plan.priceMonthly)} <span className="text-xs font-normal text-muted-foreground">/ ماه</span></div>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">{plan.features.slice(0, 4).map((f) => <li key={f}>• {f}</li>)}</ul>
            <Link to="/plans" className="mt-4 inline-block text-xs text-primary hover:underline">تغییر پلن</Link>
          </Panel>
        </div>
      </div>
    </MarketingShell>
  );
}
