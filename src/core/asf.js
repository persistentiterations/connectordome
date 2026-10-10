/** ASF protocol objects. ConnectorDome does not invent a second ASF.
 * SPDX-License-Identifier: Apache-2.0
 */

export const PROVENANCE_MODES = [
  "LIVE_LOCAL",
  "REMOTE_FEED",
  "TEST_FIXTURE",
  "SIMULATION",
  "REPLAY",
  "TEXT_CLAIM",
];

export const ACTION_AUTHORITY = "NONE";

export function utcnow() {
  return new Date().toISOString();
}

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

export async function sha256hex(input) {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const IDENTITY_FIELDS = [
  "source_id",
  "device_id",
  "capability_id",
  "source_type",
  "modality",
  "observed_at_host",
  "observed_at_device_monotonic",
  "sequence",
  "value",
  "units",
  "adapter_id",
  "adapter_version",
  "source_health",
  "provenance_mode",
  "origin_event_id",
  "action_authority",
  "source_observed_at",
  "source_published_at",
  "connector_received_at",
  "asf_ingested_at",
  "freshness_status",
];

export async function assignEventId(event) {
  const envelope = {};
  for (const k of IDENTITY_FIELDS) envelope[k] = event[k] ?? null;
  const event_id = await sha256hex(canonical(envelope));
  return { ...event, event_id };
}

export function provenanceForSourceKind(kind) {
  switch (kind) {
    case "web_api":
    case "openapi":
    case "stream":
      return "REMOTE_FEED";
    case "simulator":
      return "SIMULATION";
    case "text_claim":
      return "TEXT_CLAIM";
    case "fixture":
      return "TEST_FIXTURE";
    case "local_device":
      return "LIVE_LOCAL";
    default:
      return null;
  }
}

export function assertProvenanceAllowed(kind, mode) {
  const expected = provenanceForSourceKind(kind);
  if (!expected) throw new Error(`unknown source kind: ${kind}`);
  if (mode !== expected) {
    throw new Error(`provenance ${mode} is not allowed for source kind ${kind}; expected ${expected}`);
  }
  if (kind === "web_api" && mode === "LIVE_LOCAL") {
    throw new Error("remote HTTPS API cannot claim LIVE_LOCAL");
  }
  if (kind === "simulator" && mode === "REMOTE_FEED") {
    throw new Error("simulation cannot claim REMOTE_FEED");
  }
  if (kind === "fixture" && mode === "LIVE_LOCAL") {
    throw new Error("fixtures cannot masquerade as live");
  }
}

export function receptorEvent(partial) {
  if (partial.action_authority && partial.action_authority !== "NONE") {
    throw new Error("action_authority must be NONE");
  }
  if (!PROVENANCE_MODES.includes(partial.provenance_mode)) {
    throw new Error(`invalid provenance_mode: ${partial.provenance_mode}`);
  }
  return {
    event_id: "",
    source_id: partial.source_id,
    device_id: partial.device_id || partial.source_id,
    capability_id: partial.capability_id,
    source_type: partial.source_type,
    modality: partial.modality || "observation",
    observed_at_host: partial.observed_at_host || utcnow(),
    observed_at_device_monotonic: partial.observed_at_device_monotonic ?? null,
    sequence: partial.sequence ?? 1,
    value: partial.value,
    units: partial.units ?? null,
    adapter_id: partial.adapter_id || "connectordome.generated",
    adapter_version: partial.adapter_version || "0.1.2",
    source_health: partial.source_health || "OK",
    provenance_mode: partial.provenance_mode,
    origin_event_id: partial.origin_event_id ?? null,
    action_authority: ACTION_AUTHORITY,
    source_binding: partial.source_binding ?? null,
    transport: partial.transport ?? null,
    acquisition: partial.acquisition ?? null,
    sampling_semantics: partial.sampling_semantics ?? "polled_snapshot",
    source_observed_at: partial.source_observed_at ?? null,
    source_published_at: partial.source_published_at ?? null,
    connector_received_at: partial.connector_received_at ?? null,
    asf_ingested_at: partial.asf_ingested_at ?? null,
    poll_interval_s: partial.poll_interval_s ?? null,
    last_attempt_at: partial.last_attempt_at ?? null,
    last_success_at: partial.last_success_at ?? null,
    missed_polls: Object.prototype.hasOwnProperty.call(partial, "missed_polls") ? partial.missed_polls : null,
    freshness_status: partial.freshness_status ?? "UNKNOWN",
    freshness_threshold_s: partial.freshness_threshold_s ?? null,
    future_skew_tolerance_s: partial.future_skew_tolerance_s ?? null,
  };
}
