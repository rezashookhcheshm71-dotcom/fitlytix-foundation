import type { AssessmentTemplate } from "../types";
import { field, options, unknownOption } from "./helpers";

export const HYROX_ASSESSMENT: AssessmentTemplate = { id: "hyrox-foundation", version: 2, scope: "hyrox", sections: [
  { id: "hyrox.running", title: "دویدن و pace", description: "پایه مسابقه از اینجا ساخته می‌شود", icon: "Footprints", blockToken: "engine", fields: [
    field({ id: "hyrox.running.weekly_distance", label: "الان در هفته تقریباً چقدر می‌دوی؟", type: "select", options: options("هنوز منظم نمی‌دوم", "کمتر از ۱۰ کیلومتر", "۱۰ تا ۲۰ کیلومتر", "۲۰ تا ۳۵ کیلومتر", "بیشتر از ۳۵ کیلومتر"), required: true, purpose: "load" }),
    field({ id: "hyrox.running.easy_pace", label: "easy pace معمولت", type: "time", unit: "دقیقه/کیلومتر", depth: "intermediatePlus", allowUnknown: true, purpose: "level" }),
    field({ id: "hyrox.running.longest_recent", label: "طولانی‌ترین دوی یک ماه اخیر", type: "number", unit: "کیلومتر", allowUnknown: true, purpose: "load" }),
  ]},
  { id: "hyrox.race", title: "تجربه مسابقه", description: "برای انتخاب pacing و هدف واقع‌بینانه", icon: "Timer", blockToken: "wod", fields: [
    field({ id: "hyrox.race.experience", label: "تا حالا HYROX مسابقه دادی؟", type: "select", options: options("نه، اولین بارمه", "شبیه‌سازی تمرینی داشتم", "یک مسابقه", "چند مسابقه"), required: true, purpose: "level" }),
    field({ id: "hyrox.race.goal", label: "هدف این دوره", type: "select", options: options("تمام کردن با کنترل", "بهبود زمان", "تقویت ایستگاه‌ها", "دویدن بهتر بین ایستگاه‌ها", "آمادگی رقابتی"), required: true, purpose: "goal" }),
    field({ id: "hyrox.race.pacing", label: "معمولاً کجا pace از دستت می‌ره؟", type: "select", options: options("اوایل تند شروع می‌کنم", "بعد از sledها", "نیمه دوم دویدن", "Wall Ball", "هنوز تجربه ندارم"), depth: "intermediatePlus", purpose: "programming" }),
  ]},
  { id: "hyrox.stations", title: "ایستگاه‌ها", description: "قوی و ضعیف‌ها برای توزیع تمرین", icon: "Grid3x3", blockToken: "strength", fields: [
    field({ id: "hyrox.stations.strong", label: "در کدام ایستگاه‌ها راحت‌تری؟", type: "multiselect", options: options("SkiErg", "Sled Push", "Sled Pull", "Burpee Broad Jump", "Row", "Farmer Carry", "Sandbag Lunges", "Wall Ball", "هنوز نمی‌دونم"), purpose: "level", wide: true }),
    field({ id: "hyrox.stations.limiter", label: "کدام ایستگاه بیشتر محدودت می‌کنه؟", type: "select", options: [unknownOption, ...options("SkiErg", "Sled Push/Pull", "Burpee Broad Jump", "Row", "Farmer Carry", "Sandbag Lunges", "Wall Ball")], depth: "intermediatePlus", purpose: "programming" }),
    field({ id: "hyrox.stations.wall_balls", label: "Wall Ball بدون قطع", type: "number", unit: "تکرار", depth: "advancedPlus", allowUnknown: true, purpose: "level" }),
  ]},
  { id: "hyrox.endurance", title: "قدرت‌ـاستقامت", description: "توان حفظ فرم زیر خستگی", icon: "Dumbbell", blockToken: "strength", fields: [
    field({ id: "hyrox.endurance.carry", label: "در حمل وزنه، اول کجا خسته می‌شی؟", type: "select", options: options("گریپ", "نفس", "پاها", "مرکز بدن", "تجربه کافی ندارم"), required: true, purpose: "programming" }),
    field({ id: "hyrox.endurance.transition", label: "بعد از ایستگاه چقدر طول می‌کشه دوباره روان بدوی؟", type: "select", options: options("سریع برمی‌گردم", "حدود یک دقیقه", "بیشتر از یک دقیقه", "تا حالا تست نکردم"), depth: "advancedPlus", purpose: "level" }),
  ]},
] };