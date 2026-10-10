import {
  ACTION_AUTHORITY,
  assertProvenanceAllowed,
  provenanceForSourceKind,
  utcnow,
} from "./asf.js";
import { getByPath } from "./inspect.js";
import { suggestForField } from "./suggest.js";
import { createObservationEvent, normalizeObservation, observationError } from "./observation.js";

export function mapField(inspection, mapping) {
  const path = mapping.field;
  if (!path) throw new Error("field required");
  const raw = getByPath(inspection.body, path);
  if (raw === undefined) {
    return { status: "SCHEMA_DRIFT", field: path, value: undefined, note: "mapped field missing; not fabricated" };
  }
  const sug = suggestForField(path);
  const capability = mapping.capability === undefined ? sug.capability : String(mapping.capability).trim();
  if (!capability || !String(capability).trim()) throw observationError("MALFORMED_CONFIGURATION", "capability identifier required");
  const data_type = mapping.data_type || typeof raw;
  const value = normalizeObservation(raw, data_type);
  return {
    status: "OK",
    field: path,
    raw,
    value,
    capability,
    units: mapping.units ?? sug.units,
    data_type,
    time_field: mapping.time_field || null,
    modality: mapping.modality || sug.modality,
  };
}

export async function previewEvent({ inspection, mapping, kind }) {
  const acquisitionKind = inspection.provenance_class === "TEST_FIXTURE" ? "fixture" : kind;
  const mode = provenanceForSourceKind(acquisitionKind);
  assertProvenanceAllowed(acquisitionKind, mode);
  if (inspection.provenance_class && inspection.provenance_class !== mode) {
    throw observationError("PROVENANCE_MISMATCH", `observed ${inspection.provenance_class}, declared ${mode}`);
  }
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
  const received = inspection.connector_received_at || utcnow();
  const ingested = utcnow();
  const manifest = {
    name: mapping.name || "preview",
    version: "0.1.2",
    source_kind: acquisitionKind,
    source_host: inspection.source,
    source_reference: inspection.source_reference || inspection.url || inspection.source,
    provenance_mode: mode,
    transport: acquisitionKind === "fixture" ? "embedded" : acquisitionKind === "simulator" ? "none" : "https-get",
    acquisition: acquisitionKind === "text_claim" ? "operator_text" : acquisitionKind === "fixture" ? "embedded_fixture" : "GET",
    sampling_semantics: "polled_snapshot",
    poll_interval_s: mapping.poll_interval_s ?? (kind === "stream" ? 1 : null),
    freshness_threshold_s: mapping.freshness_threshold_s ?? 300,
    observation_mode: acquisitionKind === "fixture" ? "historical" : mapping.observation_mode || "current",
    capabilities: [{ capability_id: mapped.capability, field: mapped.field, units: mapped.units, data_type: mapped.data_type, time_field: mapping.time_field || null, modality: mapped.modality }],
  };
  const event = await createObservationEvent({ body: inspection.body, manifest, receivedAt: received, ingestedAt: ingested });
  return {
    raw: inspection.body,
    asf: event,
    schema_drift: false,
    action_authority: ACTION_AUTHORITY,
    note: "AI suggestions are not authority. Verification is mechanical.",
  };
}

export function simulationBody(seed = 1) {
  const parsed = Number(seed);
  const n = Number.isInteger(parsed) ? Math.abs(parsed) : 1;
  return { charge_percent: 50 + (n % 40), temperature_c: 20 + (n % 7), n };
}

export function textClaimBody(statement, value) {
  return { statement, claimed: value };
}
