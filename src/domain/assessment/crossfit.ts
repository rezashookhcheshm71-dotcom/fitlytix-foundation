import type { AssessmentSection, AssessmentTemplate } from "../types";
import { field, options, unknownOption } from "./helpers";

const sections: AssessmentSection[] = [
  { id: "crossfit.foundation", title: "سطح و اسکیلینگ", description: "تا تمرین از همان روز اول درست مقیاس شود", icon: "Flame", blockToken: "warmup", fields: [
    field({ id: "crossfit.level.skill", label: "بیشتر تمرین‌ها را در چه سطحی انجام می‌دی؟", type: "select", options: options("Foundations", "Scaled", "ترکیبی از Scaled و Rx", "بیشتر Rx", "مسابقه‌ای"), required: true, purpose: "scaling" }),
    field({ id: "crossfit.level.goal", label: "فعلاً مهم‌ترین هدفت در کراس‌فیت چیه؟", type: "select", options: options("ساختن پایه", "قوی‌تر شدن", "نفس و pacing بهتر", "مهارت‌های ژیمناستیک", "وزنه‌برداری", "آمادگی مسابقه"), required: true, purpose: "goal" }),
  ]},
  { id: "crossfit.strength", title: "قدرت پایه", description: "رکوردها فقط وقتی به برنامه کمک می‌کنند که واقعاً تست شده باشند", icon: "Dumbbell", blockToken: "strength", fields: [
    field({ id: "crossfit.strength.back_squat_1rm", label: "Back Squat 1RM", type: "load", unit: "kg", allowUnknown: true, purpose: "load" }),
    field({ id: "crossfit.strength.deadlift_1rm", label: "Deadlift 1RM", type: "load", unit: "kg", allowUnknown: true, purpose: "load" }),
    field({ id: "crossfit.strength.strict_pullups", label: "بارفیکس Strict پیوسته", type: "number", unit: "تکرار", allowUnknown: true, purpose: "level" }),
  ]},
  { id: "crossfit.engine", title: "Engine و pacing", description: "برای انتخاب شدت و طول متکان‌ها", icon: "Wind", blockToken: "engine", fields: [
    field({ id: "crossfit.engine.preference", label: "در کدام نوع کار بیشتر به مشکل می‌خوری؟", type: "select", options: options("کوتاه و سنگین", "۸ تا ۱۵ دقیقه", "بیشتر از ۲۰ دقیقه", "دویدن", "روور/بایک", "مطمئن نیستم"), required: true, purpose: "programming" }),
    field({ id: "crossfit.engine.row_2k", label: "رکورد Row 2k", type: "time", unit: "دقیقه:ثانیه", depth: "intermediatePlus", allowUnknown: true, purpose: "level" }),
    field({ id: "crossfit.engine.run_5k", label: "رکورد 5K", type: "time", unit: "دقیقه:ثانیه", depth: "advancedPlus", allowUnknown: true, purpose: "level" }),
  ]},
  { id: "crossfit.wod", title: "WOD و بنچمارک‌ها", description: "این بخش برای ورزشکار باتجربه است و اجباری نیست", icon: "Flame", blockToken: "wod", fields: [
    field({ id: "crossfit.benchmark.fran", label: "Fran", type: "time", unit: "دقیقه:ثانیه", depth: "advancedPlus", allowUnknown: true, purpose: "level" }),
    field({ id: "crossfit.benchmark.grace", label: "Grace", type: "time", unit: "دقیقه:ثانیه", depth: "advancedPlus", allowUnknown: true, purpose: "level" }),
    field({ id: "crossfit.benchmark.cindy", label: "Cindy", type: "number", unit: "راند", depth: "advancedPlus", allowUnknown: true, purpose: "level" }),
  ]},
  { id: "crossfit.skill", title: "مهارت‌های ژیمناستیک", description: "مهارت‌هایی که الان با کنترل انجام می‌دی", icon: "Sparkles", blockToken: "skill", fields: [
    field({ id: "crossfit.skill.gymnastics", label: "کدام مهارت‌ها را داری؟", type: "multiselect", options: options("Kipping Pull-up", "Chest-to-Bar", "Toes-to-Bar", "Double Under", "HSPU", "Pistol"), purpose: "level", wide: true }),
    field({ id: "crossfit.skill.advanced", label: "مهارت‌های پیشرفته", type: "multiselect", options: options("Bar Muscle-up", "Ring Muscle-up", "Handstand Walk", "Strict HSPU", "هنوز هیچ‌کدام"), depth: "advancedPlus", purpose: "level", wide: true }),
  ]},
  { id: "crossfit.weightlifting", title: "وزنه‌برداری", description: "رکوردهای تست‌شده برای تعیین درصدها", icon: "Weight", blockToken: "weightlifting", fields: [
    field({ id: "crossfit.weightlifting.clean_jerk_1rm", label: "Clean & Jerk 1RM", type: "load", unit: "kg", depth: "intermediatePlus", allowUnknown: true, purpose: "load" }),
    field({ id: "crossfit.weightlifting.snatch_1rm", label: "Snatch 1RM", type: "load", unit: "kg", depth: "intermediatePlus", allowUnknown: true, purpose: "load" }),
    field({ id: "crossfit.weightlifting.limiter", label: "بیشتر کجا محدود می‌شی؟", type: "select", options: [unknownOption, ...options("تکنیک", "قدرت", "اعتماد زیر وزنه", "موبیلیتی", "ثبات بالای سر")], depth: "advancedPlus", purpose: "programming" }),
  ]},
  { id: "crossfit.recovery", title: "بعد از تمرین", description: "برای تنظیم فاصله جلسات و cooldown", icon: "Moon", blockToken: "cooldown", fields: [
    field({ id: "crossfit.recovery.soreness", label: "بعد از WOD سنگین معمولاً چقدر کوفتگی داری؟", type: "select", options: options("تا فردا خوبم", "۱ تا ۲ روز", "۳ روز یا بیشتر", "خیلی متغیره"), required: true, purpose: "recovery" }),
  ]},
];

export const CROSSFIT_ASSESSMENT: AssessmentTemplate = { id: "crossfit-foundation", version: 2, scope: "crossfit", sections };