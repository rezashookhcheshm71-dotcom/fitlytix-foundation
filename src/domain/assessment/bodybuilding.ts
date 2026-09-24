import type { AssessmentTemplate } from "../types";
import { field, options, unknownOption } from "./helpers";

export const BODYBUILDING_ASSESSMENT: AssessmentTemplate = {
  id: "bodybuilding-foundation", version: 2, scope: "bodybuilding", sections: [
    { id: "bodybuilding.direction", title: "هدف و سابقه", description: "برای انتخاب ساختار و سرعت پیشروی", icon: "Target", blockToken: "strength", fields: [
      field({ id: "bodybuilding.goal.primary", label: "بدنت را بیشتر برای چه تغییری می‌سازی؟", type: "select", options: options("عضله‌سازی", "کاهش چربی با حفظ عضله", "بازترکیب بدنی", "قدرت همراه با حجم", "آمادگی مسابقه"), required: true, purpose: "goal", wide: true }),
      field({ id: "bodybuilding.history.years", label: "چقدر سابقه بدنسازی منظم داری؟", type: "select", options: options("تازه شروع می‌کنم", "کمتر از یک سال", "۱ تا ۳ سال", "۳ تا ۶ سال", "بیشتر از ۶ سال"), required: true, purpose: "level" }),
      field({ id: "bodybuilding.schedule.sessions", label: "هفته‌ای چند جلسه واقعاً می‌تونی بدنسازی کنی؟", type: "scale", min: 1, max: 7, required: true, purpose: "programming" }),
    ]},
    { id: "bodybuilding.split", title: "تقسیم تمرین", description: "برنامه‌ای که با هفته تو قابل اجرا باشد", icon: "Grid3x3", blockToken: "strength", fields: [
      field({ id: "bodybuilding.training.split", label: "با کدام split راحت‌تری؟", type: "select", options: [unknownOption, ...options("Full Body", "Upper / Lower", "Push / Pull / Legs", "تقسیم عضلات", "فعلاً برنامه ثابتی ندارم")], required: true, purpose: "programming" }),
      field({ id: "bodybuilding.training.priority_muscles", label: "کدام عضلات برایت اولویت دارند؟", type: "multiselect", options: options("سینه", "پشت", "سرشانه", "بازو", "چهارسر", "همسترینگ/باسن", "ساق", "تعادل کلی"), required: true, purpose: "goal", wide: true }),
      field({ id: "bodybuilding.training.weak_muscles", label: "فکر می‌کنی کدام عضلات عقب‌ترند؟", type: "multiselect", options: options("سینه", "پشت", "سرشانه", "بازو", "چهارسر", "همسترینگ/باسن", "ساق", "مطمئن نیستم"), depth: "intermediatePlus", purpose: "programming", wide: true }),
      field({ id: "bodybuilding.training.exercise_confidence", label: "با حرکات اصلی چقدر راحتی؟", type: "select", options: options("نیاز به یادگیری دارم", "با راهنمایی انجام می‌دم", "فرم نسبتاً ثابت دارم", "باتجربه‌ام"), required: true, purpose: "level" }),
    ]},
    { id: "bodybuilding.capacity", title: "حجم و کنترل", description: "جزئیات بیشتر، اگر سابقه تمرین داری", icon: "Dumbbell", blockToken: "strength", fields: [
      field({ id: "bodybuilding.capacity.volume_tolerance", label: "بدنت با حجم تمرین چطور کنار میاد؟", type: "select", options: options("زود کوفته می‌شم", "حجم متوسط خوبه", "حجم بالا را خوب تحمل می‌کنم", "هنوز مطمئن نیستم"), depth: "intermediatePlus", purpose: "load" }),
      field({ id: "bodybuilding.capacity.control", label: "کنترل و حس عضله در ست‌ها", type: "select", options: options("هنوز پیداش نکردم", "در بعضی حرکات خوبه", "اغلب کنترل خوبی دارم", "نقطه قوت منه"), depth: "intermediatePlus", purpose: "programming" }),
      field({ id: "bodybuilding.capacity.failure", label: "چقدر با تمرین نزدیک failure آشنایی داری؟", type: "select", options: options("آشنا نیستم", "گاهی تا ناتوانی می‌رم", "RIR/RPE را تقریبی می‌شناسم", "دقیق مدیریت می‌کنم"), depth: "intermediatePlus", purpose: "load" }),
      field({ id: "bodybuilding.capacity.weak_points", label: "کجا بیشتر عقب‌تره؟", type: "multiselect", options: options("قدرت شروع حرکت", "کنترل بخش منفی", "دامنه حرکت", "استقامت عضله", "تقارن چپ و راست", "مورد مشخصی ندارم"), depth: "advancedPlus", purpose: "programming", wide: true }),
    ]},
    { id: "bodybuilding.lifts", title: "لیفت‌های اصلی", description: "فقط رکورد یا وزنه‌ای که با فرم خوب می‌شناسی", icon: "Weight", blockToken: "strength", fields: [
      field({ id: "bodybuilding.lifts.bench_press", label: "Bench Press", type: "load", unit: "kg", depth: "intermediatePlus", allowUnknown: true, purpose: "load" }),
      field({ id: "bodybuilding.lifts.squat", label: "Squat", type: "load", unit: "kg", depth: "advancedPlus", allowUnknown: true, purpose: "load" }),
      field({ id: "bodybuilding.lifts.rdl", label: "Romanian Deadlift", type: "load", unit: "kg", depth: "advancedPlus", allowUnknown: true, purpose: "load" }),
    ]},
    { id: "bodybuilding.support", title: "کاردیو و تغذیه", description: "برای هماهنگی حجم تمرین با ریکاوری", icon: "HeartPulse", blockToken: "cooldown", fields: [
      field({ id: "bodybuilding.cardio.frequency", label: "الان چقدر کاردیو داری؟", type: "select", options: options("تقریباً هیچ", "۱ تا ۲ جلسه سبک", "۳ جلسه یا بیشتر", "نامنظم"), required: true, purpose: "programming" }),
      field({ id: "bodybuilding.nutrition.consistency", label: "تغذیه‌ات چقدر منظم است؟", type: "select", options: options("فعلاً بی‌برنامه", "کلیات را رعایت می‌کنم", "کالری/پروتئین را دنبال می‌کنم", "برنامه تغذیه دقیق دارم"), required: true, purpose: "recovery" }),
      field({ id: "bodybuilding.equipment.access", label: "برای بدنسازی به چه چیزهایی دسترسی داری؟", type: "multiselect", options: options("دمبل", "هالتر و رک", "کابل", "دستگاه‌ها", "نیمکت قابل تنظیم", "باشگاه کامل"), required: true, purpose: "programming", wide: true }),
    ]},
  ],
};