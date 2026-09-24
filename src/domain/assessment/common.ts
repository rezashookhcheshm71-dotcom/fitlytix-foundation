import type { AssessmentTemplate } from "../types";
import { field, options } from "./helpers";

export const COMMON_ASSESSMENT: AssessmentTemplate = {
  id: "common-foundation",
  version: 2,
  scope: "common",
  sections: [
    {
      id: "common.about",
      title: "کمی درباره تو",
      description: "برای اینکه نقطه شروع را درست بشناسیم",
      icon: "User",
      fields: [
        field({ id: "common.profile.age", label: "چند سالته؟", type: "number", unit: "سال", min: 12, max: 80, required: true, purpose: "safety" }),
        field({ id: "common.profile.height_cm", label: "قدت چقدره؟", type: "number", unit: "سانتی‌متر", min: 120, max: 230, required: true, purpose: "load" }),
        field({ id: "common.profile.weight_kg", label: "وزن فعلی", type: "number", unit: "کیلوگرم", min: 35, max: 250, required: true, purpose: "load" }),
        field({ id: "common.profile.training_history", label: "چقدر سابقه تمرین منظم داری؟", type: "select", options: options("تازه می‌خوام شروع کنم", "کمتر از یک سال", "۱ تا ۳ سال", "۳ تا ۶ سال", "بیشتر از ۶ سال"), required: true, purpose: "level" }),
      ],
    },
    {
      id: "common.direction",
      title: "دنبال چه تغییری هستی؟",
      description: "هدفی که برنامه باید دور آن ساخته شود",
      icon: "Target",
      fields: [
        field({ id: "common.goals.primary", label: "این روزها بیشتر دنبال چی هستی؟", type: "select", options: options("قوی‌تر شدن", "عضله‌سازی", "کاهش چربی", "استقامت و نفس بهتر", "آمادگی مسابقه", "سلامت و حال بهتر"), required: true, purpose: "goal", wide: true }),
        field({ id: "common.goals.secondary", label: "هدف دومی هم داری؟", type: "multiselect", options: options("حرکت بهتر", "ریکاوری بهتر", "ثبات در تمرین", "یادگیری مهارت", "بدون هدف دوم"), purpose: "goal", wide: true }),
        field({ id: "common.schedule.sessions_per_week", label: "واقع‌بینانه چند جلسه در هفته وقت داری؟", type: "scale", min: 1, max: 7, required: true, purpose: "programming" }),
        field({ id: "common.schedule.minutes_per_session", label: "برای هر جلسه چقدر وقت داری؟", type: "select", options: options("۳۰ تا ۴۵ دقیقه", "۴۵ تا ۶۰ دقیقه", "۶۰ تا ۷۵ دقیقه", "بیشتر از ۷۵ دقیقه"), required: true, purpose: "programming" }),
      ],
    },
    {
      id: "common.life",
      title: "روزمره و امکانات",
      description: "برنامه باید با زندگی واقعی تو جور باشد",
      icon: "Activity",
      fields: [
        field({ id: "common.lifestyle.work_style", label: "بیشتر روزت چطور می‌گذره؟", type: "select", options: options("بیشتر نشسته", "ترکیبی", "بیشتر سرپا", "کار بدنی سنگین"), required: true, purpose: "recovery" }),
        field({ id: "common.lifestyle.daily_activity", label: "بیرون از تمرین چقدر فعالی؟", type: "select", options: options("خیلی کم", "کم", "متوسط", "زیاد"), required: true, purpose: "load" }),
        field({ id: "common.access.environment", label: "معمولاً کجا تمرین می‌کنی؟", type: "select", options: options("خانه", "هوم جیم", "باشگاه کامل", "فضای باز"), required: true, purpose: "programming" }),
        field({ id: "common.access.equipment", label: "به چه تجهیزاتی دسترسی داری؟", type: "multiselect", options: options("وزن بدن", "دمبل یا کتل‌بل", "هالتر و رک", "دستگاه بدنسازی", "هوازی مثل تردمیل/روور", "تجهیزات کامل"), required: true, purpose: "programming", wide: true }),
      ],
    },
    {
      id: "common.recovery",
      title: "خواب، درد و ریکاوری",
      description: "برای اینکه حجم تمرین امن و قابل‌تحمل باشد",
      icon: "HeartPulse",
      fields: [
        field({ id: "common.recovery.sleep_hours", label: "معمولاً چند ساعت می‌خوابی؟", type: "number", unit: "ساعت", min: 3, max: 12, step: 0.5, required: true, purpose: "recovery" }),
        field({ id: "common.recovery.quality", label: "صبح‌ها چقدر سرحال بیدار می‌شی؟", type: "scale", min: 1, max: 5, required: true, purpose: "recovery" }),
        field({ id: "common.safety.pain", label: "الان درد یا آسیبی داری که روی تمرین اثر بگذاره؟", type: "select", options: options("نه، موردی ندارم", "دارم ولی تمرین می‌کنم", "نیاز به تغییر حرکت دارم", "پزشک فعلاً تمرین را محدود کرده"), required: true, purpose: "safety", wide: true }),
        field({ id: "common.safety.areas", label: "اگر محدودیتی داری، کجاست؟", type: "multiselect", options: options("شانه", "آرنج/مچ", "کمر", "لگن", "زانو", "مچ پا", "مورد دیگری"), purpose: "safety", wide: true }),
      ],
    },
    {
      id: "common.coach_note",
      title: "یک نکته برای مربی",
      description: "هر زمینه‌ای که کمک می‌کند برنامه واقعاً مال تو باشد",
      icon: "MessageSquare",
      fields: [
        field({ id: "common.notes.coach", label: "هر چیزی هست که دوست داری مربی درباره‌ات بدونه؟", type: "textarea", hint: "مثلاً تجربه قبلی، نگرانی، برنامه کاری یا چیزی که در تمرین دوست نداری…", purpose: "programming", wide: true }),
      ],
    },
  ],
};