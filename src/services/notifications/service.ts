/**
 * Notifications domain — examples only. Nothing is delivered (no push/SMS/email connected).
 * TODO(backend): scheduler + delivery providers server-side; keep AppNotification contract.
 */
import type { AppNotification } from "@/domain/types";

export const notificationService = {
  upcoming(athleteId: string): AppNotification[] {
    const base = { athleteId, channel: "in_app" as const, delivered: false as const };
    return [
      { ...base, id: "n1", kind: "pre_workout", title: "یک ساعت تا تمرین", body: "یک میان‌وعده سبک بخور و آب همراهت باشد.", scheduledFor: "امروز ۱۷:۰۰" },
      { ...base, id: "n2", kind: "post_workout_feedback", title: "جلسه چطور بود؟", body: "RPE و حس بدنت را ثبت کن تا برنامه بعدی دقیق‌تر شود.", scheduledFor: "امروز ۲۰:۰۰" },
      { ...base, id: "n3", kind: "recovery", title: "خواب امشب", body: "هدف امشب ۷.۵ ساعت خواب است.", scheduledFor: "امروز ۲۲:۳۰" },
      { ...base, id: "n4", kind: "streak", title: "۴ هفته پیوسته", body: "این هفته هم همه جلسه‌ها را رفتی؛ همین مسیر را حفظ کن.", scheduledFor: "جمعه" },
      { ...base, id: "n5", kind: "coach_message", title: "پیام مربی", body: "برای Snatch این هفته روی پوزیشن دریافت تمرکز کن.", scheduledFor: "دیروز" },
    ];
  },
};
