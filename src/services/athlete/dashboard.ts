import type { SportId } from "@/domain/types";
import { SPORT_DASHBOARDS, type SportDashboardSnapshot } from "@/mock/sport-dashboard";

/** Dashboard read boundary. Replace this mock adapter with persisted sport profiles later. */
export const athleteDashboardService = {
  getSnapshot(sport: SportId): SportDashboardSnapshot {
    return SPORT_DASHBOARDS[sport];
  },
};