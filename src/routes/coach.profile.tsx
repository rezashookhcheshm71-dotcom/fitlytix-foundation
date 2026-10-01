import type { ReactNode } from "react";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/domain/athlete";
import { MockBadge, PageHeader, Panel, Pill, SectionHeading } from "@/components/domain/primitives";
import { SPORTS, SPORT_LIST } from "@/domain/sports";
import type { CoachAssessment } from "@/domain/types";
import { coachService } from "@/services/coach/service";

export const Route = createFileRoute("/coach/profile")({
  head: () => ({ meta: [
    { title: "پروفایل مربی — FitLytix" },
    { name: "description", content: "هویت حرفه‌ای، تخصص‌ها، مدارک، سبک مربیگری و ظرفیت پذیرش ورزشکار." },
    { property: "og:title", content: "پروفایل مربی — FitLytix" },
    { property: "og:description", content: "هویت حرفه‌ای، تخصص‌ها، مدارک، سبک مربیگری و ظرفیت پذیرش ورزشکار." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CoachProfilePage,
});

function CoachProfilePage() {
  const [p, setP] = useState<CoachAssessment>(coachService.getProfile());
  const [editing, setEditing] = useState(false);
  const set = <K extends keyof CoachAssessment>(k: K, v: CoachAssessment[K]) => setP((x) => ({ ...x, [k]: v }));
  const list = (k: "certifications" | "languages" | "expertise") => (
    <Input value={p[k].join("، ")} onChange={(e) => set(k, e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean))} className="bg-muted/40" />
  );
  return (
    <AppShell mode="coach" userName={p.displayName} userRole={p.title}>
      <PageHeader eyebrow="پروفایل مربی" title="معرفی حرفه‌ای تو" description="همین اطلاعات به ورزشکار و تیم نشان داده می‌شود و برای جور کردن ورزشکار با مربی استفاده می‌شود." actions={editing ? <><Button variant="ghost" onClick={() => { setP(coachService.getProfile()); setEditing(false); }}>انصراف</Button><Button variant="hero" onClick={() => { coachService.updateProfile(p); setEditing(false); toast("تغییرات در همین نشست ذخیره شد (ذخیره دائمی هنوز وصل نیست)."); }}>ذخیره</Button></> : <Button variant="outline" onClick={() => setEditing(true)}>ویرایش</Button>} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="text-center">
          <Avatar name={p.displayName} className="mx-auto size-20 text-2xl" />
          <h2 className="mt-3 text-lg font-bold">{p.displayName}</h2><p className="text-xs text-muted-foreground">{p.title}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">{p.sports.map((s) => <Pill key={s} color={`var(${SPORTS[s].colorToken})`}>{SPORTS[s].name}</Pill>)}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-muted/40 p-3"><div className="num text-xl font-bold">{p.yearsCoaching}</div><div className="text-[10px] text-muted-foreground">سال مربیگری</div></div><div className="rounded-xl bg-muted/40 p-3"><div className="num text-xl font-bold">{p.capacity}</div><div className="text-[10px] text-muted-foreground">ظرفیت ورزشکار</div></div></div>
          <p className="mt-3 text-[11px] text-muted-foreground">عکس پروفایل بعد از اتصال فضای ذخیره فایل اضافه می‌شود.</p>
          <MockBadge className="mt-3" label="نسخه نمایشی" />
        </Panel>
        <Panel className="space-y-4">
          {editing ? (
            <>
              <F l="نام نمایشی"><Input value={p.displayName} onChange={(e) => set("displayName", e.target.value)} className="bg-muted/40" /></F>
              <F l="عنوان"><Input value={p.title} onChange={(e) => set("title", e.target.value)} className="bg-muted/40" /></F>
              <F l="رشته‌ها"><div className="flex flex-wrap gap-1.5">{SPORT_LIST.map((s) => { const on = p.sports.includes(s.id); return <Button key={s.id} size="sm" variant={on ? "default" : "outline"} onClick={() => set("sports", on ? p.sports.filter((x) => x !== s.id) : [...p.sports, s.id])}>{s.name}</Button>; })}</div></F>
              <div className="grid gap-4 sm:grid-cols-2">
                <F l="سال‌های مربیگری"><Input dir="ltr" inputMode="numeric" value={p.yearsCoaching} onChange={(e) => set("yearsCoaching", Number(e.target.value) || 0)} className="bg-muted/40" /></F>
                <F l="ظرفیت ورزشکار"><Input dir="ltr" inputMode="numeric" value={p.capacity} onChange={(e) => set("capacity", Number(e.target.value) || 0)} className="bg-muted/40" /></F>
              </div>
              <F l="مدارک (با ، جدا کن)">{list("certifications")}</F>
              <F l="تخصص‌ها">{list("expertise")}</F>
              <F l="زبان‌ها">{list("languages")}</F>
              <F l="نوع همکاری"><div className="flex gap-1.5">{(["online", "in_person"] as const).map((d) => { const on = p.delivery.includes(d); return <Button key={d} size="sm" variant={on ? "default" : "outline"} onClick={() => set("delivery", on ? p.delivery.filter((x) => x !== d) : [...p.delivery, d])}>{d === "online" ? "آنلاین" : "حضوری"}</Button>; })}</div></F>
              <F l="سبک مربیگری"><Input value={p.style} onChange={(e) => set("style", e.target.value)} className="bg-muted/40" /></F>
              <F l="هدف حرفه‌ای"><Input value={p.goals} onChange={(e) => set("goals", e.target.value)} className="bg-muted/40" /></F>
              <F l="معرفی کوتاه"><Textarea value={p.bio} onChange={(e) => set("bio", e.target.value)} className="bg-muted/40" /></F>
            </>
          ) : (
            <>
              <SectionHeading title="درباره من" /><p className="text-sm leading-7">{p.bio}</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <D l="سبک مربیگری" v={p.style} /><D l="هدف حرفه‌ای" v={p.goals} />
                <D l="مدارک" v={p.certifications.join("، ")} /><D l="تخصص‌ها" v={p.expertise.join("، ")} />
                <D l="زبان‌ها" v={p.languages.join("، ")} /><D l="نوع همکاری" v={p.delivery.map((d) => (d === "online" ? "آنلاین" : "حضوری")).join(" و ")} />
              </dl>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
function F({ l, children }: { l: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold"><span className="mb-1.5 block">{l}</span>{children}</label>;
}
function D({ l, v }: { l: string; v: string }) {
  return <div className="rounded-xl bg-muted/40 p-3"><dt className="text-[11px] text-muted-foreground">{l}</dt><dd className="mt-1">{v}</dd></div>;
}
