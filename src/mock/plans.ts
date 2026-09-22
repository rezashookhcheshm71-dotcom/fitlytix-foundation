/** MOCK DATA — subscription plans. TODO(backend): load from commerce service / DB. */
import type { Plan } from "@/domain/types";

export const demoPlans: Plan[] = [
  {
    id: "plan_ai",
    name: "AI Coach",
    coachingType: "ai",
    priceMonthly: 1_490_000,
    currency: "IRR",
    features: ["برنامه شخصی‌سازی‌شده هفتگی", "Fitness DNA و تحلیل عملکرد", "تنظیم خودکار بر اساس ریکاوری", "پایگاه حرکات و اسکیلینگ"],
  },
  {
    id: "plan_hybrid",
    name: "Hybrid",
    coachingType: "hybrid",
    priceMonthly: 3_900_000,
    currency: "IRR",
    highlight: true,
    badge: "پیشنهاد موتور FitLytix",
    features: ["همه امکانات AI Coach", "بازبینی هفتگی مربی انسانی", "تحلیل ویدیویی حرکات", "چت با مربی", "برنامه‌ریزی مسابقه"],
  },
  {
    id: "plan_human",
    name: "Human Coach Pro",
    coachingType: "human",
    priceMonthly: 7_500_000,
    currency: "IRR",
    features: ["مربی اختصاصی", "برنامه‌نویسی دستی روزانه", "جلسه ویدیویی ماهانه", "پشتیبانی اولویت‌دار", "همه امکانات پلتفرم"],
  },
];

export const formatIRR = (v: number) => `${new Intl.NumberFormat("fa-IR").format(v / 10)} تومان`;
