/**
 * Provider adapter layer. Every source (cloud OAuth, mobile bridge or manual) implements HealthDataProvider
 * and emits RawHealthSample[] that normalize.ts maps into canonical health_metrics rows.
 * Placeholders only: no credentials, SDKs or network calls. Real adapters run server-side (or in the mobile bridge → API).
 */
import { PROVIDER_SCOPES, PROVIDER_TRANSPORT, type HealthProvider, type HealthProviderConnection, type HealthScope, type HealthSource, type ProviderTransport } from "@/domain/types";
import type { RawHealthSample } from "./normalize";

export interface HealthDataProvider {
  id: HealthSource;
  transport: ProviderTransport | "manual";
  /** False until a real, credentialed connector is shipped. UI must not offer a working connect while false. */
  available: boolean;
  scopes: HealthScope[];
  /** Starts authorization (OAuth URL or mobile bridge deep link). */
  beginConnect(athleteId: string): Promise<{ redirectUrl?: string }>;
  completeConnect(params: Record<string, string>): Promise<HealthProviderConnection>;
  fetchSamples(connection: HealthProviderConnection, since?: string): Promise<RawHealthSample[]>;
  revoke(connection: HealthProviderConnection): Promise<void>;
}

class NotAvailableError extends Error {
  constructor(id: string) { super(`Health provider "${id}" is not integrated yet`); }
}

function placeholder(id: HealthProvider): HealthDataProvider {
  const fail = () => Promise.reject(new NotAvailableError(id));
  return { id, transport: PROVIDER_TRANSPORT[id], available: false, scopes: PROVIDER_SCOPES[id], beginConnect: fail, completeConnect: fail, fetchSamples: fail, revoke: fail };
}

/** Manual source: data arrives through the manual entry form, never via sync. */
const manualProvider: HealthDataProvider = {
  id: "manual",
  transport: "manual",
  available: true,
  scopes: ["heart_rate", "hrv", "sleep", "activity", "body", "workouts"],
  beginConnect: () => Promise.resolve({}),
  completeConnect: () => Promise.reject(new Error("Manual source has no connection")),
  fetchSamples: () => Promise.resolve([]),
  revoke: () => Promise.resolve(),
};

export const HEALTH_DATA_PROVIDERS: Record<HealthSource, HealthDataProvider> = {
  garmin: placeholder("garmin"),
  apple_health: placeholder("apple_health"),
  health_connect: placeholder("health_connect"),
  whoop: placeholder("whoop"),
  oura: placeholder("oura"),
  polar: placeholder("polar"),
  fitbit: placeholder("fitbit"),
  samsung_health: placeholder("samsung_health"),
  other: placeholder("other"),
  manual: manualProvider,
};
