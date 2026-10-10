import { ACTION_AUTHORITY, assignEventId, receptorEvent, utcnow } from "./asf.js";
import { IDENTITY_FIELDS } from "./asf.js";
import { getByPath } from "./inspect.js";

export const DATA_TYPES = ["number", "string", "boolean", "object"];
export const FRESHNESS_STATES = ["FRESH", "STALE", "HISTORICAL", "UNKNOWN"];
export const DEFAULT_FUTURE_SKEW_SECONDS = 60;
const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const ISO_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;

export function observationError(code, message = code) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

export function normalizeObservation(raw, dataType) {
  if (!DATA_TYPES.includes(dataType)) throw observationError("INVALID_DATA_TYPE", dataType);
  if (raw === undefined) throw observationError("SCHEMA_DRIFT", "mapped field missing");
  if (raw === null) throw observationError("MISSING_VALUE", "null observation");
  if (dataType === "number") {
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) throw observationError("TYPE_MISMATCH", "non-finite number");
      return raw;
    }
    if (typeof raw === "string") {
      if (!raw.trim()) throw observationError("MISSING_VALUE", "blank numeric observation");
      if (raw !== raw.trim() || !NUMERIC_TEXT.test(raw)) throw observationError("TYPE_MISMATCH", "numeric strings must use an unpadded decimal grammar");
      const value = Number(raw);
      if (!Number.isFinite(value)) throw observationError("TYPE_MISMATCH", "non-finite number");
      return value;
    }
    throw observationError("TYPE_MISMATCH", `expected number, received ${typeof raw}`);
  }
  if (dataType === "string") {
    if (typeof raw !== "string") throw observationError("TYPE_MISMATCH", `expected string, received ${typeof raw}`);
    if (!raw.trim()) throw observationError("MISSING_VALUE", "blank string observation");
    return raw;
  }
  if (dataType === "boolean") {
    if (typeof raw !== "boolean") throw observationError("TYPE_MISMATCH", `expected boolean, received ${typeof raw}`);
    return raw;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) throw observationError("TYPE_MISMATCH", "expected object");
  return raw;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

export function parseSourceTime(raw) {
  if (raw === undefined) throw observationError("SCHEMA_DRIFT", "configured time field missing");
  if (raw === null || (typeof raw === "string" && !raw.trim())) throw observationError("INVALID_TIMESTAMP", "configured time is empty");
  const text = String(raw);
  const match = ISO_TIME.exec(text);
  if (!match) throw observationError("INVALID_TIMESTAMP", "expected ISO 8601 timestamp with timezone");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[11]);
  const validCalendar = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  const validClock = hour <= 23 && minute <= 59 && second <= 59;
  const validOffset = offsetHour <= 14 && offsetMinute <= 59 && (offsetHour < 14 || offsetMinute === 0);
  if (!validCalendar || !validClock || !validOffset || !Number.isFinite(Date.parse(text))) {
    throw observationError("INVALID_TIMESTAMP", "timestamp contains an impossible calendar date, clock time, or UTC offset");
  }
  return text;
}

export function classifyFreshness(sourceObservedAt, now, thresholdSeconds = 300, historical = false, futureSkewSeconds = DEFAULT_FUTURE_SKEW_SECONDS) {
  if (!sourceObservedAt) return "UNKNOWN";
  const age = Date.parse(now) - Date.parse(sourceObservedAt);
  if (!Number.isFinite(age) || age < -(futureSkewSeconds * 1000)) throw observationError("INVALID_TIMESTAMP", "source time exceeds the allowed future clock skew");
  if (historical) return "HISTORICAL";
  return age > thresholdSeconds * 1000 ? "STALE" : "FRESH";
}

export async function createObservationEvent({ body, manifest, receivedAt = utcnow(), ingestedAt = utcnow(), observedAtHost = utcnow() }) {
  const capability = manifest.capabilities?.[0];
  if (!capability) throw observationError("MALFORMED_CONFIGURATION", "one capability is required");
  const raw = getByPath(body, capability.field);
  const value = normalizeObservation(raw, capability.data_type);
  const sourceObservedAt = capability.time_field ? parseSourceTime(getByPath(body, capability.time_field)) : null;
  const freshness = classifyFreshness(sourceObservedAt, receivedAt, manifest.freshness_threshold_s ?? 300, manifest.observation_mode === "historical", manifest.future_skew_tolerance_s ?? DEFAULT_FUTURE_SKEW_SECONDS);
  const sourceHealth = freshness === "FRESH" ? "OK" : freshness === "STALE" ? "STALE" : freshness === "HISTORICAL" ? "HISTORICAL" : "UNKNOWN_FRESHNESS";
  return assignEventId(receptorEvent({
    source_id: manifest.source_id || manifest.source_host || manifest.source_reference || "unknown-source",
    device_id: manifest.device_id || manifest.source_id || manifest.source_host || manifest.source_reference || "unknown-source",
    capability_id: capability.capability_id,
    source_type: manifest.source_kind,
    modality: capability.modality || "observation",
    value,
    units: capability.units,
    provenance_mode: manifest.provenance_mode,
    transport: manifest.transport,
    acquisition: manifest.acquisition,
    sampling_semantics: manifest.sampling_semantics,
    source_observed_at: sourceObservedAt,
    connector_received_at: receivedAt,
    asf_ingested_at: ingestedAt,
    observed_at_host: observedAtHost,
    poll_interval_s: manifest.poll_interval_s,
    last_attempt_at: receivedAt,
    last_success_at: receivedAt,
    missed_polls: null,
    source_health: sourceHealth,
    freshness_status: freshness,
    freshness_threshold_s: manifest.freshness_threshold_s ?? 300,
    future_skew_tolerance_s: manifest.future_skew_tolerance_s ?? DEFAULT_FUTURE_SKEW_SECONDS,
    adapter_id: manifest.adapter_id || `connectordome.${manifest.name}`,
    adapter_version: manifest.version,
  }));
}

// Generated packages receive this same source module, with imports rewritten locally.
export function runtimeModuleSource() {
  return `export const ACTION_AUTHORITY = "NONE";\nconst DATA_TYPES = ${JSON.stringify(DATA_TYPES)};\nconst IDENTITY_FIELDS = ${JSON.stringify(IDENTITY_FIELDS)};\nconst DEFAULT_FUTURE_SKEW_SECONDS = ${DEFAULT_FUTURE_SKEW_SECONDS};\nconst NUMERIC_TEXT = ${NUMERIC_TEXT};\nconst ISO_TIME = ${ISO_TIME};\nexport ${observationError.toString()}\n${normalizeObservation.toString()}\n${isLeapYear.toString()}\n${daysInMonth.toString()}\n${parseSourceTime.toString()}\n${classifyFreshness.toString()}\n${canonicalRuntime.toString()}\n${sha256Runtime.toString()}\n${parseFieldPathRuntime.toString()}\n${getByPathRuntime.toString()}\nexport ${createRuntimeEvent.toString()}\n`;
}

function canonicalRuntime(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalRuntime).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalRuntime(value[key])}`).join(",")}}`;
}

async function sha256Runtime(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getByPathRuntime(obj, path) {
  const parts = parseFieldPathRuntime(path);
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object" || !(part in current)) throw observationError("SCHEMA_DRIFT", "mapped field missing");
    current = current[part];
  }
  return current;
}

function parseFieldPathRuntime(path) {
  if (String(path).startsWith("/")) return String(path).slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  const normalized = String(path).replace(/\[(\d+)\]/g, ".$1");
  const parts = []; let current = ""; let escaped = false;
  for (const char of normalized) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === ".") { if (current) parts.push(current); current = ""; continue; }
    current += char;
  }
  if (escaped) current += "\\";
  if (current) parts.push(current);
  return parts;
}

async function createRuntimeEvent(body, manifest, times = {}) {
  const capability = manifest.capabilities?.[0];
  if (!capability) throw observationError("MALFORMED_CONFIGURATION", "one capability is required");
  const receivedAt = times.receivedAt || new Date().toISOString();
  const ingestedAt = times.ingestedAt || new Date().toISOString();
  const observedAtHost = times.observedAtHost || new Date().toISOString();
  const value = normalizeObservation(getByPathRuntime(body, capability.field), capability.data_type);
  const sourceObservedAt = capability.time_field ? parseSourceTime(getByPathRuntime(body, capability.time_field)) : null;
  const freshness = classifyFreshness(sourceObservedAt, receivedAt, manifest.freshness_threshold_s ?? 300, manifest.observation_mode === "historical", manifest.future_skew_tolerance_s ?? DEFAULT_FUTURE_SKEW_SECONDS);
  const sourceHealth = freshness === "FRESH" ? "OK" : freshness === "STALE" ? "STALE" : freshness === "HISTORICAL" ? "HISTORICAL" : "UNKNOWN_FRESHNESS";
  const event = {
    event_id: "",
    source_id: manifest.source_id || manifest.source_host || manifest.source_reference || "unknown-source",
    device_id: manifest.device_id || manifest.source_id || manifest.source_host || manifest.source_reference || "unknown-source",
    capability_id: capability.capability_id,
    source_type: manifest.source_kind,
    modality: capability.modality || "observation",
    observed_at_host: observedAtHost,
    observed_at_device_monotonic: null,
    sequence: 1,
    value,
    units: capability.units ?? null,
    adapter_id: manifest.adapter_id || `connectordome.${manifest.name}`,
    adapter_version: manifest.version,
    source_health: sourceHealth,
    provenance_mode: manifest.provenance_mode,
    origin_event_id: null,
    action_authority: ACTION_AUTHORITY,
    source_binding: null,
    transport: manifest.transport,
    acquisition: manifest.acquisition,
    sampling_semantics: manifest.sampling_semantics,
    source_observed_at: sourceObservedAt,
    source_published_at: null,
    connector_received_at: receivedAt,
    asf_ingested_at: ingestedAt,
    poll_interval_s: manifest.poll_interval_s ?? null,
    last_attempt_at: receivedAt,
    last_success_at: receivedAt,
    missed_polls: null,
    freshness_status: freshness,
    freshness_threshold_s: manifest.freshness_threshold_s ?? 300,
    future_skew_tolerance_s: manifest.future_skew_tolerance_s ?? DEFAULT_FUTURE_SKEW_SECONDS
  };
  const identity = {};
  for (const field of IDENTITY_FIELDS) identity[field] = event[field] ?? null;
  event.event_id = await sha256Runtime(canonicalRuntime(identity));
  return event;
}
