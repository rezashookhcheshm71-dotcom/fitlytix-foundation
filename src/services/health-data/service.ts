/**
 * Health data service — provider-agnostic connections + standardized metrics.
 * No real OAuth/sync exists: `requestConnect` always reports "not available yet".
 * Tokens/secrets must only ever live server-side in a future connector implementation.
 * TODO(backend): back with wearable_connections / health_metrics tables (docs/schema/future-schema.sql).
 */
import {
  METRIC_DEFS,
  manualHealthInputSchema,
  type ConnectionStatus,
  type HealthMetric,
  type HealthMetricType,
  type HealthProvider,
  type HealthProviderConnection,
  type ManualHealthInput,
  type WearableIntent,
} from "@/domain/types";
import { DEMO_CONNECTIONS, DEMO_HEALTH_METRICS } from "@/mock/health-data";

/** Contract each future provider adapter (server-side) must implement. */
export interface HealthProviderConnector {
  provider: HealthProvider;
  authorizeUrl(athleteId: string): Promise<string>;
  handleCallback(params: Record<string, string>): Promise<HealthProviderConnection>;
  sync(connection: HealthProviderConnection, since?: string): Promise<HealthMetric[]>;
}

/** Registry intentionally empty — no live integrations in this version. */
export const HEALTH_CONNECTORS: Partial<Record<HealthProvider, HealthProviderConnector>> = {};

const connections: HealthProviderConnection[] = [...DEMO_CONNECTIONS];
const metrics: HealthMetric[] = [...DEMO_HEALTH_METRICS];
const intents = new Map<string, WearableIntent>([["ath_001", "yes"]]);
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const healthDataService = {
  intent(athleteId: string): WearableIntent | undefined {
    return intents.get(athleteId);
  },
  /** From assessment: records intent and creates ready_to_connect rows — never "connected". */
  setIntent(athleteId: string, intent: WearableIntent, providers: HealthProvider[] = []) {
    intents.set(athleteId, intent);
    if (intent !== "yes") return;
    const now = new Date().toISOString();
    for (const provider of providers) {
      if (connections.some((c) => c.athleteId === athleteId && c.provider === provider)) continue;
      connections.push({ id: uid("hc"), athleteId, provider, status: "ready_to_connect", createdAt: now, updatedAt: now });
    }
  },
  listConnections(athleteId: string) {
    return connections.filter((c) => c.athleteId === athleteId);
  },
  overallStatus(athleteId: string): ConnectionStatus {
    const list = this.listConnections(athleteId);
    if (list.some((c) => c.status === "connected")) return "connected";
    if (list.some((c) => c.status === "sync_error")) return "sync_error";
    if (list.length) return "ready_to_connect";
    return this.listMetrics(athleteId).some((m) => m.source === "manual") ? "manual" : "not_connected";
  },
  requestConnect(provider: HealthProvider): { available: boolean; message: string } {
    return HEALTH_CONNECTORS[provider]
      ? { available: true, message: "" }
      : { available: false, message: "اتصال مستقیم به این سرویس هنوز فعال نشده. تا آن موقع می‌توانی داده‌ها را دستی وارد کنی." };
  },
  validateManual(input: unknown) {
    return manualHealthInputSchema.safeParse(input);
  },
  /** Append-only: each value becomes a new metric row. */
  addManual(athleteId: string, input: ManualHealthInput): HealthMetric[] {
    const parsed = manualHealthInputSchema.parse(input);
    const now = new Date().toISOString();
    const start = new Date(parsed.measuredAt).toISOString();
    const rows = (Object.entries(parsed.values) as [HealthMetricType, number][]).map(([metricType, value]) => ({
      id: uid("hm"), athleteId, source: "manual" as const, metricType, value, unit: METRIC_DEFS[metricType].unit, startTime: start, createdAt: now,
    }));
    metrics.push(...rows);
    return rows;
  },
  listMetrics(athleteId: string, type?: HealthMetricType) {
    return metrics.filter((m) => m.athleteId === athleteId && (!type || m.metricType === type)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
  latestByType(athleteId: string): Partial<Record<HealthMetricType, HealthMetric>> {
    const out: Partial<Record<HealthMetricType, HealthMetric>> = {};
    for (const m of this.listMetrics(athleteId)) out[m.metricType] = m;
    return out;
  },
};
