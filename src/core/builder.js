import {
  ACTION_AUTHORITY,
  assignEventId,
  assertProvenanceAllowed,
  provenanceForSourceKind,
  receptorEvent,
  utcnow,
} from "./asf.js";
import { getByPath } from "./inspect.js";
import { looksLikeTimeField, suggestForField } from "./suggest.js";

export function mapField(inspection, mapping) {
  const path = mapping.field;
  if (!path) throw new Error("field required");
  const raw = getByPath(inspection.body, path);
  if (raw === undefined) {
    return { status: "SCHEMA_DRIFT", field: path, value: undefined, note: "mapped field missing; not fabricated" };
  }
  const sug = suggestForField(path);
  return {
    status: "OK",
    field: path,
    raw,
    capability: mapping.capability || sug.capability,
    units: mapping.units ?? sug.units,
    data_type: mapping.data_type || typeof raw,
    time_field: mapping.time_field || null,
    modality: mapping.modality || sug.modality,
  };
}

export async function previewEvent({ inspection, mapping, kind }) {
  const mode = provenanceForSourceKind(kind);
  assertProvenanceAllowed(kind, mode);
  const mapped = mapField(inspection, mapping);
  if (mapped.status === "SCHEMA_DRIFT") {
    return {
      raw: inspection.body,
      asf: null,
      schema_drift: true,
      field: mapped.field,
      action_authority: ACTION_AUTHORITY,
    };
  }
  let source_observed_at = null;
  if (mapping.time_field) {
    const t = getByPath(inspection.body, mapping.time_field);
    source_observed_at = t == null ? null : String(t);
  } else {
    const timeField = (inspection.fields || []).map((f) => f.path).find(looksLikeTimeField);
    if (timeField) {
      const t = getByPath(inspection.body, timeField);
      source_observed_at = t == null ? null : String(t);
    }
  }
  const received = inspection.connector_received_at || utcnow();
  const ingested = utcnow();
  const event = await assignEventId(
    receptorEvent({
      source_id: inspection.source || "remote",
      capability_id: mapped.capability,
      source_type: kind,
      modality: mapped.modality,
      value: mapped.data_type === "number" ? Number(mapped.raw) : mapped.raw,
      units: mapped.units,
      provenance_mode: mode,
      transport: kind === "simulator" ? "none" : "https-get",
      acquisition: kind === "text_claim" ? "operator_text" : "GET",
      sampling_semantics: kind === "stream" ? "polled_snapshot" : "polled_snapshot",
      source_observed_at,
      source_published_at: null,
      connector_received_at: received,
      asf_ingested_at: ingested,
      poll_interval_s: mapping.poll_interval_s ?? (kind === "stream" ? 1 : null),
      last_attempt_at: received,
      last_success_at: received,
      missed_polls: 0,
      source_health: inspection.reachability === "OK" ? "OK" : "UNAVAILABLE",
    }),
  );
  return {
    raw: inspection.body,
    asf: event,
    schema_drift: false,
    action_authority: ACTION_AUTHORITY,
    note: "AI suggestions are not authority. Verification is mechanical.",
  };
}

export function simulationBody(seed = 1) {
  const n = Math.abs(Number(seed) || 1);
  return { charge_percent: 50 + (n % 40), temperature_c: 20 + (n % 7), n };
}

export function textClaimBody(statement, value) {
  return { statement, claimed: value };
}
