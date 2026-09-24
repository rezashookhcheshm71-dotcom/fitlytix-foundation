import type { AssessmentTemplate } from "../types";
import { field, options } from "./helpers";

export const FUNCTIONAL_ASSESSMENT: AssessmentTemplate = { id: "functional-foundation", version: 2, scope: "functional", sections: [
  { id: "functional.movement", title: "کیفیت حرکت", description: "نه تست تخصصی؛ چیزی که در حرکت حس می‌کنی", icon: "Activity", blockToken: "warmup", fields: [
    field({ id: "functional.movement.squat", label: "در اسکوات با وزن بدن کدام حالت نزدیک‌تره؟", type: "select", options: options("راحت و با کنترل", "تعادلم به‌هم می‌خوره", "پاشنه جدا می‌شه", "زانو/کمر اذیت می‌شه", "مطمئن نیستم"), required: true, purpose: "safety" }),
    field({ id: "functional.movement.overhead", label: "دست‌ها را بالای سر بردن چطوره؟", type: "select", options: options("بدون محدودیت", "کمی خشک", "یک سمت محدودتره", "درد دارم", "مطمئن نیستم"), required: true, purpose: "safety" }),
  ]},
  { id: "functional.mobility", title: "موبیلیتی و تعادل", description: "برای انتخاب دامنه و نسخه مناسب حرکت", icon: "Sunrise", blockToken: "warmup", fields: [
    field({ id: "functional.mobility.areas", label: "کجا بیشتر احساس خشکی می‌کنی؟", type: "multiselect", options: options("مچ پا", "لگن", "پشت ران", "ستون فقرات سینه‌ای", "شانه", "مورد مشخصی ندارم"), purpose: "programming", wide: true }),
    field({ id: "functional.balance.single_leg", label: "ایستادن روی یک پا برای ۲۰ ثانیه", type: "select", options: options("هر دو سمت راحت", "یک سمت سخت‌تر", "هر دو سمت سخت", "تا حالا امتحان نکردم"), required: true, purpose: "level" }),
  ]},
  { id: "functional.strength", title: "قدرت کاربردی", description: "کنترل بدن در الگوهای اصلی", icon: "Dumbbell", blockToken: "strength", fields: [
    field({ id: "functional.strength.unilateral", label: "حرکات تک‌پا مثل lunge چطورند؟", type: "select", options: options("با کنترل", "تعادل سخت می‌شه", "ضعف یک‌طرفه دارم", "درد دارم", "تجربه ندارم"), required: true, purpose: "scaling" }),
    field({ id: "functional.strength.core", label: "در plank با فرم خوب چقدر می‌مونی؟", type: "select", options: options("کمتر از ۲۰ ثانیه", "۲۰ تا ۴۵ ثانیه", "۴۵ تا ۹۰ ثانیه", "بیشتر از ۹۰ ثانیه", "تست نکردم"), purpose: "level" }),
  ]},
  { id: "functional.conditioning", title: "آمادگی و هماهنگی", description: "برای تنظیم پیچیدگی و شدت جلسه", icon: "Wind", blockToken: "engine", fields: [
    field({ id: "functional.conditioning.preference", label: "کدام تمرین را بیشتر دوست داری؟", type: "select", options: options("قدرتی و کنترل‌شده", "دایره‌ای و پرتحرک", "ترکیبی", "تمرکز روی حرکت و موبیلیتی"), required: true, purpose: "programming" }),
    field({ id: "functional.coordination.experience", label: "با حرکات ترکیبی چقدر راحتی؟", type: "select", options: options("تازه‌کارم", "با توضیح انجام می‌دم", "روان انجام می‌دم", "چالش بیشتر می‌خوام"), depth: "intermediatePlus", purpose: "level" }),
  ]},
] };