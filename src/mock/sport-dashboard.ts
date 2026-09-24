import type { DnaDimension, SportId } from "@/domain/types";

export interface SportDashboardSnapshot {
  sport: SportId;
  level: string;
  focus: string;
  workout: { title: string; detail: string; duration: number; blocks: string[] };
  program: { name: string; phase: string; week: number; totalWeeks: number; adherence: number };
  metrics: Array<{ label: string; value: string; note: string }>;
  dna: { archetype: string; dimensions: DnaDimension[]; insights: Array<{ label: string; text: string }> };
  sessions: Array<{ date: string; title: string; result: string; load: string }>;
}

const dimension = (id: string, label: string, labelEn: string, score: number, trend: number, insight: string): DnaDimension => ({ id, label, labelEn, score, trend, insight });

export const SPORT_DASHBOARDS: Record<SportId, SportDashboardSnapshot> = {
  crossfit: {
    sport: "crossfit", level: "پیشرفته", focus: "امروز کیفیت Snatch مهم‌تر از وزنه است؛ در WOD دور اول را کنترل‌شده شروع کن.",
    workout: { title: "Snatch Control + Mixed WOD", detail: "تکنیک، قدرت و یک متکان ۱۴ دقیقه‌ای", duration: 68, blocks: ["Warm-up", "Weightlifting", "WOD", "Cooldown"] },
    program: { name: "Capacity 12", phase: "Build", week: 5, totalWeeks: 12, adherence: 0.9 },
    metrics: [{ label: "قدرت نسبی", value: "82", note: "+۳ این دوره" }, { label: "Engine", value: "68", note: "+۶ این دوره" }, { label: "Rx هفته", value: "3/4", note: "یک جلسه Scaled" }],
    dna: { archetype: "موتور قدرتی", dimensions: [dimension("strength", "قدرت", "Strength", 82, 3, "قدرت پایین‌تنه بالاست"), dimension("engine", "موتور", "Engine", 68, 6, "pacing رو به رشد است"), dimension("gymnastics", "ژیمناستیک", "Gymnastics", 54, 2, "ثبات حلقه عقب‌تر است"), dimension("weightlifting", "وزنه‌برداری", "Weightlifting", 76, 5, "تکنیک زیر خستگی بهتر شده"), dimension("mobility", "موبیلیتی", "Mobility", 58, -1, "شانه نیاز به توجه دارد"), dimension("recovery", "ریکاوری", "Recovery", 71, 4, "خواب این هفته بهتر بوده")], insights: [{ label: "نقطه قوت", text: "قدرت پایین‌تنه و استمرار تمرین" }, { label: "فعلاً عقب‌تر", text: "ثبات ژیمناستیک روی حلقه" }, { label: "تمرکز هفته", text: "Snatch با فرم ثابت و pacing محافظه‌کار" }] },
    sessions: [{ date: "۳۰ شهریور", title: "Engine + Snatch", result: "12:44", load: "RPE 8" }, { date: "۲۹ شهریور", title: "Back Squat + Fran", result: "4:38 Rx", load: "RPE 9" }, { date: "۲۷ شهریور", title: "Gymnastics + AMRAP", result: "8+14", load: "RPE 7" }],
  },
  bodybuilding: {
    sport: "bodybuilding", level: "متوسط", focus: "در پرس بالا سینه دامنه کامل را نگه دار؛ امروز دنبال رکورد نیستیم، کیفیت تکرار مهم‌تر است.",
    workout: { title: "Upper A · Chest Priority", detail: "سینه بالایی، پشت و دلت میانی", duration: 72, blocks: ["Activation", "Compound", "Hypertrophy", "Finisher"] },
    program: { name: "Balanced Hypertrophy", phase: "Accumulation", week: 4, totalWeeks: 10, adherence: 0.86 },
    metrics: [{ label: "حجم هفتگی", value: "16.8k", note: "+۸٪" }, { label: "ست سینه", value: "14", note: "در محدوده هدف" }, { label: "میانگین RIR", value: "2.1", note: "کنترل‌شده" }],
    dna: { archetype: "حجم کنترل‌شده", dimensions: [dimension("hypertrophy", "هایپرتروفی", "Growth", 77, 4, "پاسخ سینه و پشت خوب است"), dimension("strength", "قدرت", "Strength", 69, 2, "پرس پایدارتر شده"), dimension("volume", "تحمل حجم", "Volume", 73, 5, "حجم متوسط را خوب تحمل می‌کنی"), dimension("control", "کنترل عضله", "Control", 64, 3, "در سرشانه جای رشد دارد"), dimension("symmetry", "تقارن", "Symmetry", 58, 1, "سمت چپ کمی عقب‌تر است"), dimension("recovery", "ریکاوری", "Recovery", 75, 4, "فاصله جلسات مناسب است")], insights: [{ label: "نقطه قوت", text: "تحمل حجم و پیشرفت حرکات فشاری" }, { label: "فعلاً عقب‌تر", text: "کنترل دلت میانی سمت چپ" }, { label: "تمرکز هفته", text: "تکرارهای تمیز با ۲ RIR" }] },
    sessions: [{ date: "۳۰ شهریور", title: "Lower A · Quad", result: "15.4k kg", load: "14 ست" }, { date: "۲۸ شهریور", title: "Upper B · Back", result: "13.8k kg", load: "16 ست" }, { date: "۲۶ شهریور", title: "Upper A · Chest", result: "12.9k kg", load: "15 ست" }],
  },
  running: {
    sport: "running", level: "متوسط", focus: "easy run امروز باید واقعاً آسان بماند؛ اگر نفس سنگین شد، pace را پایین بیاور.",
    workout: { title: "Easy 7K + Strides", detail: "Zone 2 و شش شتاب کوتاه", duration: 52, blocks: ["Warm-up", "Easy Run", "Strides", "Mobility"] },
    program: { name: "10K زیر ۵۰ دقیقه", phase: "Base + Threshold", week: 6, totalWeeks: 12, adherence: 0.92 },
    metrics: [{ label: "مسافت هفته", value: "28.4", note: "km · +۲.۱" }, { label: "easy pace", value: "6:08", note: "min/km" }, { label: "Zone 2", value: "71٪", note: "از زمان دویدن" }],
    dna: { archetype: "دونده پایدار", dimensions: [dimension("aerobic", "هوازی", "Aerobic", 78, 5, "پایه هوازی قابل اتکاست"), dimension("threshold", "آستانه", "Threshold", 66, 4, "tempo رو به بهبود است"), dimension("speed", "سرعت", "Speed", 57, 2, "اقتصاد سرعت جای رشد دارد"), dimension("economy", "اقتصاد دویدن", "Economy", 63, 3, "cadence پایدارتر شده"), dimension("durability", "دوام", "Durability", 72, 6, "افت pace کمتر شده"), dimension("recovery", "ریکاوری", "Recovery", 74, 1, "بار فعلی قابل تحمل است")], insights: [{ label: "نقطه قوت", text: "پایه هوازی و ثبات هفته‌ها" }, { label: "فعلاً عقب‌تر", text: "سرعت در تکرارهای کوتاه" }, { label: "تمرکز هفته", text: "easy واقعی و یک tempo کنترل‌شده" }] },
    sessions: [{ date: "۳۰ شهریور", title: "Tempo 3×8 min", result: "5:04/km", load: "8.6 km" }, { date: "۲۸ شهریور", title: "Easy Run", result: "6:12/km", load: "7.1 km" }, { date: "۲۵ شهریور", title: "Long Run", result: "6:18/km", load: "13 km" }],
  },
  hyrox: {
    sport: "hyrox", level: "متوسط", focus: "روی خروج از Sled Pull عجله نکن؛ ۲۰۰ متر اول دویدن را برای برگشت ریتم نگه دار.",
    workout: { title: "Run + Sled Transition", detail: "چهار تکرار یک کیلومتر با ایستگاه قدرتی", duration: 64, blocks: ["Run", "Sled", "Carry", "Wall Ball"] },
    program: { name: "HYROX Race Build", phase: "Specific", week: 7, totalWeeks: 12, adherence: 0.88 },
    metrics: [{ label: "Race pace", value: "5:18", note: "min/km" }, { label: "Sled 50m", value: "2:06", note: "-۸ ثانیه" }, { label: "Wall Ball", value: "42", note: "پیوسته" }],
    dna: { archetype: "موتور مقاوم", dimensions: [dimension("running", "دویدن", "Running", 72, 4, "pace یکنواخت‌تر شده"), dimension("sled", "Sled", "Sled", 61, 6, "قدرت هل‌دادن رشد کرده"), dimension("erg", "Erg", "Erg", 76, 2, "Row نقطه قوت است"), dimension("carry", "Carry", "Carry", 68, 3, "گریپ پایدارتر شده"), dimension("wallball", "Wall Ball", "Wall Ball", 58, 4, "ست‌های بلند هنوز سخت‌اند"), dimension("pacing", "Pacing", "Pacing", 65, 5, "transitionها بهتر شده")], insights: [{ label: "نقطه قوت", text: "Erg و حفظ ریتم در میانه مسابقه" }, { label: "فعلاً عقب‌تر", text: "Wall Ball بعد از دویدن" }, { label: "تمرکز هفته", text: "transition آرام و برگشت سریع به pace" }] },
    sessions: [{ date: "۳۰ شهریور", title: "Compromised Running", result: "52:18", load: "RPE 8" }, { date: "۲۸ شهریور", title: "Sled + Carry", result: "6 rounds", load: "RPE 8" }, { date: "۲۶ شهریور", title: "Zone 2 Run", result: "8.4 km", load: "RPE 5" }],
  },
  functional: {
    sport: "functional", level: "مبتدی", focus: "امروز دامنه بدون درد مهم است؛ در Split Squat سمت چپ را آهسته و کنترل‌شده انجام بده.",
    workout: { title: "Move Better · Full Body", detail: "موبیلیتی، قدرت یک‌طرفه و core", duration: 48, blocks: ["Mobility", "Unilateral", "Core", "Conditioning"] },
    program: { name: "Everyday Strength", phase: "Foundation", week: 3, totalWeeks: 8, adherence: 0.94 },
    metrics: [{ label: "کیفیت حرکت", value: "74", note: "+۵" }, { label: "تعادل چپ/راست", value: "88٪", note: "+۳٪" }, { label: "جلسات", value: "3/3", note: "این هفته" }],
    dna: { archetype: "پایه متعادل", dimensions: [dimension("movement", "کیفیت حرکت", "Movement", 74, 5, "اسکوات روان‌تر شده"), dimension("mobility", "موبیلیتی", "Mobility", 62, 4, "مچ پا بهتر شده"), dimension("unilateral", "قدرت یک‌طرفه", "Unilateral", 59, 6, "سمت چپ در حال جبران است"), dimension("core", "مرکز بدن", "Core", 71, 3, "ثبات خوب است"), dimension("balance", "تعادل", "Balance", 67, 4, "کنترل تک‌پا بهتر شده"), dimension("conditioning", "آمادگی", "Conditioning", 64, 2, "شدت متوسط مناسب است")], insights: [{ label: "نقطه قوت", text: "ثبات مرکز بدن و استمرار" }, { label: "فعلاً عقب‌تر", text: "قدرت تک‌پای چپ" }, { label: "تمرکز هفته", text: "دامنه راحت و کنترل آهسته" }] },
    sessions: [{ date: "۳۰ شهریور", title: "Full Body Control", result: "کامل", load: "RPE 6" }, { date: "۲۸ شهریور", title: "Mobility + Core", result: "۴۵ دقیقه", load: "RPE 4" }, { date: "۲۵ شهریور", title: "Unilateral Strength", result: "کامل", load: "RPE 7" }],
  },
};