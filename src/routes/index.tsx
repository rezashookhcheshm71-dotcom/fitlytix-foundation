import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowLeft, ArrowUpLeft, Brain, Check, ClipboardCheck, Dna, Gauge, Play, RefreshCw, RouteIcon, ShieldCheck, Sparkles, Users } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Bar, MockBadge, Panel, Pill, ProgressRing, Stat } from "@/components/domain/primitives";
import { DnaRadarChart, PerformanceTrendChart } from "@/components/domain/charts";
import { SportIcon } from "@/components/domain/sport";
import { SPORT_LIST } from "@/domain/sports";
import { demoDNA, demoPerformance, demoRecovery } from "@/mock/athlete";
import { demoPlans, formatIRR } from "@/mock/plans";
import athleteHero from "@/assets/fitlytix-athlete-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitLytix — مربی‌گری هوشمند برای ورزشکاران جدی" },
      { name: "description", content: "ارزیابی، Fitness DNA، برنامه شخصی و حلقه عملکرد در یک پلتفرم؛ برای کراس‌فیت، هایراکس، فانکشنال، بدنسازی و دویدن." },
      { property: "og:title", content: "FitLytix — مربی‌گری هوشمند برای ورزشکاران جدی" },
      { property: "og:description", content: "بدنت را بشناس. مسیرت را بساز. ارزیابی، Fitness DNA، برنامه شخصی و مربی‌گری تطبیقی در یک پلتفرم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const journey = [
  { icon: ClipboardCheck, en: "Assess", fa: "ارزیابی", desc: "بدن، سابقه، هدف و رشته" },
  { icon: Dna, en: "Understand", fa: "شناخت", desc: "ساخت Fitness DNA" },
  { icon: RouteIcon, en: "Plan", fa: "برنامه", desc: "مسیر شخصی و قابل اجرا" },
  { icon: Play, en: "Train", fa: "تمرین", desc: "جلسه‌های دقیق و هدفمند" },
  { icon: Gauge, en: "Measure", fa: "اندازه‌گیری", desc: "عملکرد، ریکاوری و بازخورد" },
  { icon: RefreshCw, en: "Adapt", fa: "تطبیق", desc: "اصلاح برنامه با داده واقعی" },
];

const faqs = [
  ["FitLytix چه تفاوتی با اپ‌های تمرینی معمولی دارد؟", "FitLytix فقط یک فهرست تمرین نیست. ارزیابی، داده عملکرد، ریکاوری، هدف و سابقه شما را در یک مدل مشترک جمع می‌کند تا برنامه با بدن و مسیر واقعی شما هماهنگ شود."],
  ["مربی هوشمند جای مربی انسانی را می‌گیرد؟", "خیر. موتور هوشمند یک ابزار تحلیل و برنامه‌ریزی است، نه چت‌بات و نه جایگزین مربی. می‌توانید AI Coach، مربی انسانی یا مدل Hybrid را انتخاب کنید."],
  ["Fitness DNA چیست؟", "نمایی چندبعدی از قدرت، توان، موتور، مهارت، تحرک، ریکاوری و استمرار شماست که از ارزیابی و روند عملکرد ساخته می‌شود."],
  ["برای چه سطحی مناسب است؟", "از مبتدی تا ورزشکار حرفه‌ای. عمق ارزیابی بر اساس تجربه تغییر می‌کند و برای ورزشکاران باتجربه، PRها، Benchmarkها، مهارت‌ها و اسکیلینگ هم وارد مدل می‌شوند."],
  ["آیا پرداخت و هوش مصنوعی در این نسخه فعال است؟", "این نسخه یک تجربه نمایشی محصول است. خروجی‌های هوشمند، احراز هویت و پرداخت فعلاً شبیه‌سازی شده‌اند و هیچ تراکنش واقعی انجام نمی‌شود."],
];

function Landing() {
  return (
    <MarketingShell>
      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b border-border/60">
        <img src={athleteHero} alt="ورزشکار کراس‌فیت در فضای تمرین" width={1600} height={1200} fetchPriority="high" className="absolute inset-0 size-full object-cover object-[37%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.12_0.006_260/5%)_0%,oklch(0.12_0.006_260/64%)_45%,oklch(0.12_0.006_260/98%)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--background)_0%,transparent_35%)]" />
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl items-center px-4 py-16 md:px-8">
          <div className="max-w-2xl animate-rise">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/55 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-md">
              <Activity className="size-3.5 text-primary" /> Intelligent Sports Coaching & Performance
            </div>
            <h1 className="text-4xl font-black leading-[1.2] md:text-6xl lg:text-7xl">بدنت را بشناس.<br /><span className="text-gradient-ember">مسیرت را بساز.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-foreground/75 md:text-lg">FitLytix پلتفرم هوشمند مربی‌گری و عملکرد است؛ جایی که ارزیابی، Fitness DNA، برنامه شخصی و داده هر تمرین، یک مسیر قابل اندازه‌گیری می‌سازند.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl"><Link to="/register">شروع ارزیابی <ArrowLeft /></Link></Button>
              <Button asChild variant="glass" size="xl"><Link to="/login">ورود به FitLytix</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground/60">
              {["ارزیابی رشته‌محور", "برنامه تطبیقی", "AI + مربی انسانی"].map((x) => <span key={x} className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-success" />{x}</span>)}
            </div>
          </div>
          <div className="absolute bottom-6 left-4 hidden w-[360px] animate-rise rounded-lg border border-border bg-background/72 p-4 shadow-card backdrop-blur-xl lg:block [animation-delay:180ms]">
            <div className="flex items-center justify-between"><div><div className="text-[10px] text-muted-foreground">TODAY'S READINESS</div><div className="num text-2xl font-bold">78 <span className="text-xs text-success">آماده</span></div></div><ProgressRing value={78} size={52} stroke={5} color="var(--success)"><span className="num text-xs font-bold">78</span></ProgressRing></div>
            <div className="mt-3"><PerformanceTrendChart data={demoPerformance} height={74} /></div>
          </div>
        </div>
      </section>

      <section id="journey" className="scroll-mt-20 border-b border-border/60 py-20 md:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <SectionIntro eyebrow="THE FITLYTIX LOOP" title="از حدس زدن تا تصمیم گرفتن" text="هر مرحله، داده مرحله بعد را دقیق‌تر می‌کند. برنامه ثابت نمی‌ماند؛ با عملکرد واقعی شما رشد می‌کند." />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
            {journey.map((step, i) => <li key={step.en} className="group relative bg-card p-5 transition-colors hover:bg-card-elevated"><span className="num absolute end-4 top-4 text-[10px] text-muted-foreground">0{i + 1}</span><step.icon className="mb-6 size-5 text-primary" /><div className="font-display text-xs font-bold text-primary">{step.en}</div><h3 className="mt-1 font-bold">{step.fa}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{step.desc}</p></li>)}
          </ol>
        </div>
      </section>

      <section id="sports" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <SectionIntro eyebrow="FIVE SPORTS · ONE PERFORMANCE LAYER" title="رشته تو، منطق تمرین تو" text="هر رشته مدل ارزیابی، شاخص‌ها و ساختار برنامه خودش را دارد؛ بدون اینکه داده‌های پایه ورزشکار از هم جدا شوند." />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SPORT_LIST.map((sport) => { const color = `var(${sport.colorToken})`; return <Link key={sport.id} to="/assessment/sport" search={{ sport: sport.id }} className="group relative min-h-56 overflow-hidden rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-foreground/20"><div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} /><SportIcon sport={sport} className="size-7" /><div className="mt-10 font-display text-lg font-bold">{sport.name}</div><div className="text-sm font-semibold" style={{ color }}>{sport.nameFa}</div><p className="mt-3 text-xs leading-6 text-muted-foreground">{sport.tagline}</p><ArrowUpLeft className="absolute bottom-5 end-5 size-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" /></Link>; })}
          </div>
        </div>
      </section>

      <section id="intelligence" className="scroll-mt-20 border-y border-border/60 bg-card/25 py-20 md:py-28">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div><SectionIntro eyebrow="FITNESS DNA" title="یک تصویر زنده از ورزشکار" text="قدرت، توان، موتور، مهارت، تحرک، ریکاوری و استمرار در یک پروفایل چندبعدی. نه یک امتیاز تزئینی؛ ورودی مستقیم برنامه‌ریزی." /><div className="mt-7 space-y-4">{demoDNA.dimensions.slice(0, 4).map((d) => <div key={d.id}><div className="mb-1.5 flex justify-between text-xs"><span>{d.label} <span className="font-display text-muted-foreground">{d.labelEn}</span></span><span className="num font-bold">{d.score}</span></div><Bar value={d.score / 100} height={5} /></div>)}</div><Button asChild variant="outline" className="mt-8"><Link to="/athlete/fitness-dna">مشاهده Fitness DNA نمونه <ArrowLeft /></Link></Button></div>
          <div className="relative mx-auto w-full max-w-xl"><div className="absolute inset-10 bg-primary/10 blur-3xl" /><Panel glass className="relative grid min-h-[430px] items-center rounded-lg md:grid-cols-[1fr_0.8fr]"><DnaRadarChart dimensions={demoDNA.dimensions} height={320} /><div className="space-y-3"><div><div className="text-xs text-muted-foreground">ARCHETYPE</div><div className="text-xl font-extrabold">{demoDNA.archetype}</div><div className="font-display text-sm text-primary">{demoDNA.archetypeEn}</div></div>{demoDNA.strengths.map((s) => <Pill key={s} color="var(--success)">{s}</Pill>)}<div className="pt-3 text-xs leading-6 text-muted-foreground">پروفایل نمایشی بر پایه داده ورزشکار کراس‌فیت</div></div></Panel></div>
        </div>
      </section>

      <section className="py-20 md:py-28"><div className="mx-auto w-full max-w-7xl px-4 md:px-8"><SectionIntro eyebrow="COACHING, NOT CHATTING" title="هوش تحلیل می‌کند. مربی تصمیم می‌گیرد." text="FitLytix هوش مصنوعی را به شکل یک موتور پشت محصول به‌کار می‌گیرد؛ نه یک صفحه چت. انتخاب می‌کنی چه میزان از مسیر با موتور هوشمند و چه میزان با مربی انسانی پیش برود." /><div className="mt-10 grid gap-4 lg:grid-cols-3"><CoachingCard icon={Brain} title="AI Coach" en="ALWAYS ADAPTIVE" text="برنامه بر اساس ارزیابی، هدف، تجربه، عملکرد و ریکاوری ساخته و به‌روزرسانی می‌شود." items={["تنظیم هفتگی برنامه", "پیشنهاد شدت و حجم", "تحلیل روند عملکرد"]} /><CoachingCard icon={Users} title="Human Coach" en="HUMAN JUDGEMENT" text="یک مربی واقعی داده‌های شما را می‌بیند، زمینه را درک می‌کند و تصمیم‌های حساس را هدایت می‌کند." items={["برنامه‌ریزی اختصاصی", "بازبینی تکنیک و ویدیو", "ارتباط مستقیم با مربی"]} /><CoachingCard icon={Sparkles} title="Hybrid" en="BEST OF BOTH" text="سرعت تحلیل موتور هوشمند در کنار قضاوت و تجربه مربی؛ برای ورزشکارانی که جدی‌تر پیش می‌روند." items={["بازبینی هفتگی مربی", "تطبیق مداوم برنامه", "آمادگی مسابقه"]} featured /></div></div></section>

      <section className="border-y border-border/60 bg-card/25 py-20 md:py-28"><div className="mx-auto grid w-full max-w-7xl gap-12 px-4 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><SectionIntro eyebrow="PERFORMANCE, IN CONTEXT" title="اعداد وقتی ارزش دارند که به تصمیم برسند" text="روند عملکرد، آمادگی روزانه، بار تمرین، PRها، Benchmarkها و بازخورد هر جلسه کنار هم دیده می‌شوند." /><Panel className="rounded-lg"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div className="flex gap-7"><Stat label="Performance Index" value="75" delta={14} tone="primary" /><Stat label="Readiness" value={demoRecovery.readiness} unit="%" tone="success" /></div><MockBadge label="داده نمایشی · ۸ هفته" /></div><PerformanceTrendChart data={demoPerformance} height={240} /></Panel></div></section>

      <section className="py-20 md:py-28"><div className="mx-auto w-full max-w-7xl px-4 md:px-8"><SectionIntro eyebrow="PLANS" title="نوع مربی‌گری متناسب با مسیر تو" text="بعد از ارزیابی، FitLytix یک پلن پیشنهاد می‌دهد. انتخاب نهایی همیشه با شماست." /><div className="mt-10 grid gap-3 md:grid-cols-3">{demoPlans.map((p) => <Panel key={p.id} className={`flex flex-col rounded-lg ${p.highlight ? "border-primary/50 bg-primary-soft" : ""}`}><div className="flex items-center justify-between"><div className="font-display text-lg font-bold">{p.name}</div>{p.highlight && <Pill color="var(--primary)">پیشنهادی</Pill>}</div><div className="mt-3 text-xl font-extrabold">{formatIRR(p.priceMonthly)} <span className="text-xs font-normal text-muted-foreground">/ ماه</span></div><ul className="mt-5 flex-1 space-y-2 text-xs text-muted-foreground">{p.features.slice(0, 3).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{f}</li>)}</ul><Button asChild variant={p.highlight ? "hero" : "outline"} className="mt-6"><Link to="/plans">جزئیات پلن‌ها</Link></Button></Panel>)}</div></div></section>

      <section className="border-t border-border/60 py-20 md:py-28"><div className="mx-auto grid w-full max-w-5xl gap-10 px-4 md:grid-cols-[0.7fr_1.3fr] md:px-8"><SectionIntro eyebrow="FAQ" title="سؤال‌های پیش از شروع" text="آنچه لازم است پیش از ساخت مسیر خود بدانید." /><Accordion type="single" collapsible className="border-t border-border">{faqs.map(([q, a], i) => <AccordionItem key={q} value={`faq-${i}`}><AccordionTrigger className="text-start text-sm no-underline hover:no-underline md:text-base">{q}</AccordionTrigger><AccordionContent className="text-sm leading-7 text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion></div></section>

      <section className="px-4 pb-20 md:px-8 md:pb-28"><div className="relative mx-auto flex w-full max-w-7xl flex-col items-center overflow-hidden rounded-lg border border-primary/25 bg-gradient-carbon px-6 py-16 text-center md:py-20"><div className="grid-noise absolute inset-0 opacity-35" /><ShieldCheck className="relative mb-5 size-8 text-primary" /><h2 className="relative text-3xl font-black md:text-5xl">اولین تصمیم دقیق، شناختن نقطه شروع است.</h2><p className="relative mt-4 max-w-xl text-sm leading-7 text-muted-foreground">ارزیابی را شروع کن و ببین FitLytix چطور داده‌های پراکنده را به یک مسیر تمرینی قابل اجرا تبدیل می‌کند.</p><div className="relative mt-7 flex flex-col gap-3 sm:flex-row"><Button asChild variant="hero" size="lg"><Link to="/register">شروع ارزیابی <ArrowLeft /></Link></Button><Button asChild variant="outline" size="lg"><Link to="/athlete/dashboard">مشاهده محصول</Link></Button></div></div></section>
    </MarketingShell>
  );
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div><div className="font-display text-xs font-bold text-primary">{eyebrow}</div><h2 className="mt-3 max-w-3xl text-2xl font-black leading-[1.35] md:text-4xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base md:leading-8">{text}</p></div>; }

function CoachingCard({ icon: Icon, title, en, text, items, featured }: { icon: typeof Brain; title: string; en: string; text: string; items: string[]; featured?: boolean }) { return <Panel className={`relative rounded-lg ${featured ? "border-primary/45 bg-primary-soft" : ""}`}><Icon className="mb-8 size-7 text-primary" /><div className="font-display text-[10px] font-bold text-muted-foreground">{en}</div><h3 className="mt-1 text-xl font-extrabold">{title}</h3><p className="mt-3 min-h-20 text-sm leading-7 text-muted-foreground">{text}</p><ul className="mt-5 space-y-2 text-sm">{items.map((x) => <li key={x} className="flex gap-2"><Check className="mt-1 size-3.5 text-success" />{x}</li>)}</ul></Panel>; }
