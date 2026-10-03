/**
 * Health data service — provider-agnostic connections + standardized metrics.
 * No real OAuth/sync exists: `requestConnect` always reports "not available yet" and nothing ever becomes `connected`.
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
import { normalizeSample, type RawHealthSample } from "./normalize";

/** Contract each future provider adapter (server-side or mobile bridge → API) must implement. */
export interface HealthProviderConnector {
  provider: HealthProvider;
  authorizeUrl(athleteId: string): Promise<string>;
  handleCallback(params: Record<string, string>): Promise<HealthProviderConnection>;
  fetchSamples(connection: HealthProviderConnection, since?: string): Promise<RawHealthSample[]>;
  revoke(connection: HealthProviderConnection): Promise<void>;
}

/** Registry intentionally empty — no live integrations in this version. */
export const HEALTH_CONNECTORS: Partial<Record<HealthProvider, HealthProviderConnector>> = {};

let connections: HealthProviderConnection[] = [...DEMO_CONNECTIONS];
const metrics: HealthMetric[] = [...DEMO_HEALTH_METRICS];
const intents = new Map<string, WearableIntent>([["ath_001", "yes"]]);
const selections = new Map<string, HealthProvider[]>([["ath_001", ["garmin"]]]);
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const healthDataService = {
  intent(athleteId: string): WearableIntent | undefined {
    return intents.get(athleteId);
  },
  selectedProviders(athleteId: string): HealthProvider[] {
    return selections.get(athleteId) ?? [];
  },
  /** From assessment: records intent/source and creates ready_to_connect rows — never "connected". */
  setIntent(athleteId: string, intent: WearableIntent, providers: HealthProvider[] = []) {
    intents.set(athleteId, intent);
    selections.set(athleteId, intent === "yes" ? providers : []);
    if (intent !== "yes") return;
    const now = new Date().toISOString();
    for (const provider of providers) {
      if (connections.some((c) => c.athleteId === athleteId && c.provider === provider)) continue;
      connections.push({ id: uid("hc"), athleteId, provider, status: "ready_to_connect", scopes: [], createdAt: now, updatedAt: now });
    }
  },
  listConnections(athleteId: string) {
    return connections.filter((c) => c.athleteId === athleteId);
  },
  /** Removes the row locally; a real connector must also call `revoke` server-side. */
  disconnect(athleteId: string, connectionId: string) {
    const target = connections.find((c) => c.id === connectionId && c.athleteId === athleteId);
    connections = connections.filter((c) => c !== target);
    if (target) selections.set(athleteId, this.selectedProviders(athleteId).filter((p) => p !== target.provider));
  },
  overallStatus(athleteId: string): ConnectionStatus {
    const list = this.listConnections(athleteId);
    if (list.some((c) => c.status === "connected")) return "connected";
    if (list.some((c) => c.status === "sync_error")) return "sync_error";
    if (list.length) return "ready_to_connect";
    return this.listMetrics(athleteId).some((m) => m.source === "manual") || intents.get(athleteId) === "manual" ? "manual" : "not_connected";
  },
  requestConnect(provider: HealthProvider): { available: boolean; message: string } {
    return HEALTH_CONNECTORS[provider]
      ? { available: true, message: "" }
      : { available: false, message: "اتصال مستقیم به این سرویس در نسخه بعدی فعال می‌شود. تا آن موقع می‌توانی داده‌ها را دستی وارد کنی." };
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
  /** Future connector ingest path: normalize then append. Unknown/implausible samples are dropped. */
  ingest(athleteId: string, connection: HealthProviderConnection, samples: RawHealthSample[]): HealthMetric[] {
    const now = new Date().toISOString();
    const rows = samples
      .map((s) => normalizeSample(athleteId, connection.provider, s, connection.id))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ ...r, id: uid("hm"), createdAt: now }));
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
