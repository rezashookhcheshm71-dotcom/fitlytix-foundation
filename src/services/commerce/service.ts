/**
 * Commerce service boundary.
 * Flow: Registration -> Assessment -> Sport -> Coaching Type -> Suggested Plan
 *       -> Subscription -> Payment -> Membership -> Dashboard
 *
 * Payment is MOCK ONLY. Nothing here talks to a gateway.
 * TODO(backend): integrate payment provider via server route; persist subscriptions/payments.
 */
import type { CoachingType, Payment, Plan, Subscription } from "@/domain/types";
import { demoPlans } from "@/mock/plans";

export const commerceService = {
  async listPlans(): Promise<Plan[]> {
    return demoPlans;
  },
  suggestPlan(coachingType: CoachingType): Plan {
    return demoPlans.find((p) => p.coachingType === coachingType) ?? demoPlans[1];
  },
  async createMockCheckout(planId: string): Promise<{ subscription: Subscription; payment: Payment }> {
    const now = new Date().toISOString();
    return {
      subscription: {
        id: "sub_mock",
        athleteId: "ath_001",
        planId,
        status: "trial",
        startedAt: now,
        renewsAt: now,
      },
      payment: {
        id: "pay_mock",
        subscriptionId: "sub_mock",
        amount: demoPlans.find((p) => p.id === planId)?.priceMonthly ?? 0,
        currency: "IRR",
        status: "mock",
        createdAt: now,
      },
    };
  },
};
