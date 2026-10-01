/**
 * Package / subscription boundary. Payment is NOT connected; status is always a visible demo state.
 * TODO(backend): read active subscription from DB after a real payment provider is integrated server-side.
 */
import type { PackageId, ProductPackage } from "@/domain/types";

export const PACKAGES: Record<PackageId, ProductPackage> = {
  training: { id: "training", name: "تمرین", includes: { training: true, nutrition: false }, coachingModes: ["ai", "human", "hybrid"] },
  nutrition: { id: "nutrition", name: "تغذیه", includes: { training: false, nutrition: true }, coachingModes: ["ai", "human", "hybrid"] },
  combined: { id: "combined", name: "تمرین + تغذیه", includes: { training: true, nutrition: true }, coachingModes: ["ai", "human", "hybrid"] },
};

const active = new Map<string, PackageId>([["ath_001", "combined"]]);

export const subscriptionService = {
  getPackage(athleteId: string, override?: PackageId): ProductPackage {
    return PACKAGES[override ?? active.get(athleteId) ?? "training"];
  },
  paymentStatus(): { label: string; connected: false } {
    return { label: "پرداخت هنوز متصل نیست · وضعیت نمایشی", connected: false };
  },
};
