import type { AssessmentTemplate } from "../types";
import { field, options } from "./helpers";

export const RUNNING_ASSESSMENT: AssessmentTemplate = { id: "running-foundation", version: 2, scope: "running", sections: [
  { id: "running.base", title: "پایه دویدن", description: "حجم فعلی، نه چیزی که دوست داری انجام بدهی", icon: "Footprints", blockToken: "engine", fields: [
    field({ id: "running.base.history", label: "چقدر منظم می‌دوی؟", type: "select", options: options("تازه شروع می‌کنم", "کمتر از ۶ ماه", "۶ ماه تا ۲ سال", "۲ تا ۵ سال", "بیشتر از ۵ سال"), required: true, purpose: "level" }),
    field({ id: "running.base.weekly_mileage", label: "میانگین مسافت هفتگی", type: "select", options: options("هنوز منظم نیست", "کمتر از ۱۰ کیلومتر", "۱۰ تا ۲۵ کیلومتر", "۲۵ تا ۴۵ کیلومتر", "بیشتر از ۴۵ کیلومتر"), required: true, purpose: "load" }),
    field({ id: "running.base.surface", label: "بیشتر کجا می‌دوی؟", type: "multiselect", options: options("تردمیل", "خیابان/آسفالت", "پیست", "تریل", "ترکیبی"), required: true, purpose: "programming" }),
  ]},
  { id: "running.pace", title: "pace و رکوردهای اخیر", description: "اگر تست نکردی، همان را انتخاب کن", icon: "Timer", blockToken: "engine", fields: [
    field({ id: "running.pace.easy", label: "easy pace معمول", type: "time", unit: "دقیقه/کیلومتر", depth: "intermediatePlus", allowUnknown: true, purpose: "level" }),
    field({ id: "running.pace.recent_race", label: "pace آخرین مسابقه یا تایم‌تریال", type: "time", unit: "دقیقه/کیلومتر", depth: "intermediatePlus", allowUnknown: true, purpose: "level" }),
    field({ id: "running.records.5k", label: "رکورد اخیر 5K", type: "time", unit: "دقیقه:ثانیه", allowUnknown: true, purpose: "level" }),
    field({ id: "running.records.10k", label: "رکورد اخیر 10K", type: "time", unit: "دقیقه:ثانیه", depth: "intermediatePlus", allowUnknown: true, purpose: "level" }),
    field({ id: "running.records.half", label: "رکورد نیمه‌ماراتن", type: "time", unit: "ساعت:دقیقه", depth: "advancedPlus", allowUnknown: true, purpose: "level" }),
  ]},
  { id: "running.training", title: "نوع تمرین", description: "برای ساخت هفته‌ای متعادل", icon: "Wind", blockToken: "engine", fields: [
    field({ id: "running.training.zones", label: "با zone ضربان یا pace تمرین می‌کنی؟", type: "select", options: options("نه، با حس می‌دوم", "کمی آشنا هستم", "با zone تمرین می‌کنم", "داده دقیق دارم"), required: true, purpose: "programming" }),
    field({ id: "running.training.max_hr", label: "حداکثر ضربان ثبت‌شده", type: "number", unit: "bpm", depth: "advancedPlus", allowUnknown: true, purpose: "programming" }),
    field({ id: "running.training.intervals", label: "تجربه interval و tempo", type: "select", options: options("ندارم", "گاهی", "هفته‌ای یک جلسه", "منظم و برنامه‌ریزی‌شده"), depth: "intermediatePlus", purpose: "level" }),
  ]},
  { id: "running.goal", title: "مسابقه و سلامت", description: "هدف و چیزهایی که باید مراقبشان باشیم", icon: "Target", blockToken: "cooldown", fields: [
    field({ id: "running.goal.race", label: "هدف بعدی‌ات چیه؟", type: "select", options: options("دویدن پیوسته و راحت", "5K", "10K", "نیمه‌ماراتن", "ماراتن", "بهبود pace بدون مسابقه"), required: true, purpose: "goal" }),
    field({ id: "running.safety.injury_history", label: "در یک سال اخیر آسیب مرتبط با دویدن داشتی؟", type: "multiselect", options: options("نه", "ساق/شین", "زانو", "همسترینگ", "آشیل/مچ", "کمر/لگن", "مورد دیگر"), required: true, purpose: "safety", wide: true }),
  ]},
] };