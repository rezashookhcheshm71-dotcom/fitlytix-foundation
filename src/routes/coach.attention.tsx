import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Eye } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { coachService } from "@/services/coach/service";

export const Route = createFileRoute("/coach/attention")({
  head: () => ({ meta: [
    { title: "نیاز به توجه — مربی FitLytix" },
    { name: "description", content: "ورزشکارانی که آمادگی، پایبندی یا روند عملکردشان نیاز به پیگیری دارد." },
    { property: "og:title", content: "نیاز به توجه — مربی FitLytix" },
    { property: "og:description", content: "ورزشکارانی که آمادگی، پایبندی یا روند عملکردشان نیاز به پیگیری دارد." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AttentionPage,
});

function AttentionPage() {
  const items = coachService.attention();
  return (
    <AppShell mode="coach" userName="سارا موسوی" userRole="مربی">
      <PageHeader eyebrow="نیاز به توجه" title="امروز اول سراغ این‌ها برو" description="هر مورد دلیل مشخص و یک اقدام پیشنهادی دارد؛ تصمیم نهایی با توست." actions={<MockBadge label="قواعد نمایشی" />} />
      {items.length === 0 ? <Panel className="text-center text-sm text-muted-foreground">موردی برای پیگیری نیست.</Panel> : (
        <div className="space-y-3">{items.map((i) => (
          <Panel key={i.id} className={i.severity === "act" ? "border-destructive/30" : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {i.severity === "act" ? <AlertTriangle className="mt-0.5 size-4 text-destructive" /> : <Eye className="mt-0.5 size-4 text-warning" />}
                <div><Link to="/coach/athlete/$id" params={{ id: i.athleteId }} className="font-bold hover:text-primary">{i.athleteName}</Link><p className="num text-xs text-muted-foreground">{i.detail}</p></div>
              </div>
              <Pill color={i.severity === "act" ? "var(--destructive)" : "var(--warning)"}>{i.severity === "act" ? "اقدام" : "زیر نظر"}</Pill>
            </div>
            <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">قدم بعدی: {i.suggestedAction}</p>
          </Panel>
        ))}</div>
      )}
    </AppShell>
  );
}
