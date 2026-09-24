import type { SportId } from "@/domain/types";
import { SPORT_DASHBOARDS, type SportDashboardSnapshot } from "@/mock/sport-dashboard";

/** Dashboard read boundary. Replace this mock adapter with persisted sport profiles later. */
export const athleteDashboardService = {
  getSnapshot(athleteId: string, sport: SportId): SportDashboardSnapshot {
    // athleteId is part of the read contract now; persisted profiles replace this adapter later.
    void athleteId;
    return SPORT_DASHBOARDS[sport];
  },
};