/**
 * Deterministic Global Grounding Reference v0.3 primitives.
 * Observation-only: this module never creates action authority.
 * SPDX-License-Identifier: Apache-2.0
 */
import { canonical, sha256hex } from "./asf.js";
import { parseSourceTime, observationError } from "./observation.js";

export const GGR_VERSION = "connectordome.ggr/v0.3";
export const FRAME_VERSION = "connectordome.observation-frame/v0.3";
export const ACTION_AUTHORITY = "NONE";

const ANCHOR_KINDS = new Set(["FIXED_TERRESTRIAL", "MOVING", "PORTABLE", "SIMULATED", "SCIENTIFIC"]);

function finite(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw observationError("INVALID_REFERENCE", `${field} must be finite`);
  return value;
}

function validatePosition(position) {
  if (!position || typeof position !== "object") throw observationError("INVALID_REFERENCE", "position is required");
  const latitude = finite(position.latitude, "latitude");
  const longitude = finite(position.longitude, "longitude");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw observationError("INVALID_REFERENCE", "position is outside EPSG:4326 bounds");
  }
  return { latitude, longitude, ...(position.altitude_m == null ? {} : { altitude_m: finite(position.altitude_m, "altitude_m") }) };
}

export async function resolveAnchor(input) {
  if (!input || typeof input !== "object") throw observationError("INVALID_REFERENCE", "anchor declaration is required");
  if (!ANCHOR_KINDS.has(input.kind)) throw observationError("INVALID_REFERENCE", "unsupported anchor kind");
  if (!input.reference_id || !input.coordinate_reference) throw observationError("INVALID_REFERENCE", "reference_id and coordinate_reference are required");
  if (input.coordinate_reference !== "EPSG:4326") throw observationError("UNSUPPORTED_REFERENCE", "v0.3 demonstration resolves EPSG:4326 only");
  const validFrom = parseSourceTime(input.validity?.from);
  const validTo = input.validity?.to ? parseSourceTime(input.validity.to) : null;
  if (validTo && Date.parse(validTo) < Date.parse(validFrom)) throw observationError("INVALID_REFERENCE", "validity interval is reversed");
  const timeUncertaintyMs = finite(input.time_basis?.uncertainty_ms, "time_basis.uncertainty_ms");
  const spatialUncertaintyM = finite(input.spatial_uncertainty_m, "spatial_uncertainty_m");
  if (timeUncertaintyMs < 0 || spatialUncertaintyM < 0) throw observationError("INVALID_REFERENCE", "uncertainty cannot be negative");
  const resolved = {
    schema: GGR_VERSION,
    reference_id: String(input.reference_id),
    kind: input.kind,
    coordinate_reference: input.coordinate_reference,
    position: validatePosition(input.position),
    spatial_uncertainty_m: spatialUncertaintyM,
    time_basis: { scale: input.time_basis?.scale || "UTC", uncertainty_ms: timeUncertaintyMs },
    validity: { from: validFrom, to: validTo },
    provenance: input.provenance || { mode: "UNKNOWN" },
    simulated: input.kind === "SIMULATED",
    action_authority: ACTION_AUTHORITY,
  };
  return { ...resolved, anchor_id: await sha256hex(canonical(resolved)) };
}

function observationDigestFields(observation) {
  const { integrity, ...rest } = observation;
  return rest;
}

export async function computeObservationIntegrity(observation) {
  return sha256hex(canonical(observationDigestFields(observation)));
}

function haversineMeters(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function exclusion(observation, code, detail) {
  return {
    source_id: observation?.source_id || "UNKNOWN",
    capability_id: observation?.capability_id || null,
    status: code,
    detail,
  };
}

async function assessObservation(observation, anchor, request) {
  if (observation?.availability === "UNAVAILABLE") return { excluded: exclusion(observation, "UNAVAILABLE", observation.unavailable_reason || "source unavailable") };
  if (observation?.withdrawn === true) return { excluded: exclusion(observation, "SOURCE_WITHDRAWN", "source withdrew this observation") };
  let measurementTime;
  let retrievalTime;
  try {
    measurementTime = parseSourceTime(observation?.measurement_time);
    retrievalTime = parseSourceTime(observation?.retrieval_time);
  } catch (error) {
    return { excluded: exclusion(observation, error.code || "INVALID_TIMESTAMP", error.message) };
  }
  if (observation.reference?.coordinate_reference !== anchor.coordinate_reference) {
    return { excluded: exclusion(observation, "INCOMPATIBLE_REFERENCE", "no verified transform is available") };
  }
  let position;
  try {
    position = validatePosition(observation.position);
  } catch (error) {
    return { excluded: exclusion(observation, "INVALID_REFERENCE", error.message) };
  }
  if (!observation.integrity?.sha256) return { excluded: exclusion(observation, "UNVERIFIED_PROVENANCE", "integrity digest is absent") };
  const actualDigest = await computeObservationIntegrity(observation);
  if (actualDigest !== observation.integrity.sha256) return { excluded: exclusion(observation, "TAMPERED", "observation digest does not match its declaration") };
  const targetMs = Date.parse(request.target_time);
  const distanceFromTargetS = Math.abs(Date.parse(measurementTime) - targetMs) / 1000;
  if (distanceFromTargetS > request.temporal_tolerance_s) {
    return { excluded: exclusion(observation, "STALE", `measurement is ${distanceFromTargetS}s from the requested time`) };
  }
  if (request.permitted_use && !observation.permissions?.permitted_uses?.includes(request.permitted_use)) {
    return { excluded: exclusion(observation, "USE_NOT_PERMITTED", `source does not declare ${request.permitted_use} permission`) };
  }
  const spatialDistanceM = haversineMeters(anchor.position, position);
  if (request.spatial_radius_m != null && spatialDistanceM > request.spatial_radius_m) {
    return { excluded: exclusion(observation, "OUTSIDE_SPATIAL_SCOPE", `source is ${Math.round(spatialDistanceM)}m from the anchor`) };
  }
  return {
    included: {
      ...observation,
      measurement_time: measurementTime,
      retrieval_time: retrievalTime,
      frame_relation: {
        transform: "EPSG:4326_DIRECT",
        distance_from_anchor_m: Number(spatialDistanceM.toFixed(3)),
        combined_spatial_uncertainty_m: anchor.spatial_uncertainty_m + (observation.spatial_uncertainty_m || 0),
        combined_time_uncertainty_ms: anchor.time_basis.uncertainty_ms + (observation.temporal_uncertainty_ms || 0),
      },
      action_authority: ACTION_AUTHORITY,
    },
  };
}

export async function buildObservationFrame(input) {
  const anchor = input?.anchor?.anchor_id ? input.anchor : await resolveAnchor(input?.anchor);
  const targetTime = parseSourceTime(input?.target_time);
  if (Date.parse(targetTime) < Date.parse(anchor.validity.from) || (anchor.validity.to && Date.parse(targetTime) > Date.parse(anchor.validity.to))) {
    throw observationError("REFERENCE_UNAVAILABLE", "anchor is not valid at the requested time");
  }
  const request = {
    target_time: targetTime,
    temporal_tolerance_s: finite(input.temporal_tolerance_s ?? 600, "temporal_tolerance_s"),
    spatial_radius_m: input.spatial_radius_m == null ? null : finite(input.spatial_radius_m, "spatial_radius_m"),
    permitted_use: input.permitted_use || null,
    observation_types: [...(input.observation_types || [])].sort(),
  };
  if (request.temporal_tolerance_s < 0 || (request.spatial_radius_m != null && request.spatial_radius_m < 0)) {
    throw observationError("INVALID_FRAME_REQUEST", "scope values cannot be negative");
  }
  const included = [];
  const excluded = [];
  for (const observation of input.observations || []) {
    if (request.observation_types.length && !request.observation_types.includes(observation.capability_id)) {
      excluded.push(exclusion(observation, "TYPE_NOT_REQUESTED", "capability is outside the request"));
      continue;
    }
    const assessment = await assessObservation(observation, anchor, request);
    if (assessment.included) included.push(assessment.included);
    else excluded.push(assessment.excluded);
  }
  included.sort((a, b) => `${a.source_id}:${a.capability_id}`.localeCompare(`${b.source_id}:${b.capability_id}`));
  excluded.sort((a, b) => `${a.source_id}:${a.capability_id}`.localeCompare(`${b.source_id}:${b.capability_id}`));
  const expectedSources = [...new Set(input.expected_sources || (input.observations || []).map((item) => item.source_id))].sort();
  const represented = new Set(included.map((item) => item.source_id));
  const exclusionsByReason = {};
  for (const item of excluded) exclusionsByReason[item.status] = (exclusionsByReason[item.status] || 0) + 1;
  const body = {
    schema: FRAME_VERSION,
    frame_revision: input.frame_revision || 1,
    supersedes_frame_id: input.supersedes_frame_id || null,
    anchor,
    request,
    observations: included,
    exclusions: excluded,
    coverage: {
      expected_sources: expectedSources,
      represented_sources: [...represented].sort(),
      missing_sources: expectedSources.filter((source) => !represented.has(source)),
      included_count: included.length,
      excluded_count: excluded.length,
      exclusions_by_reason: exclusionsByReason,
      complete_world_measurement: false,
    },
    reconstruction_notice: "Time-scoped reconstruction of participating observations; not a globally simultaneous or complete world state.",
    simulated_conditions_present: included.some((item) => item.provenance?.mode === "SIMULATION") || excluded.some((item) => item.source_id?.startsWith("sim-")),
    action_authority: ACTION_AUTHORITY,
  };
  return { ...body, frame_id: await sha256hex(canonical(body)) };
}

export async function compareFrames(left, right) {
  if (left?.schema !== FRAME_VERSION || right?.schema !== FRAME_VERSION) throw observationError("INCOMPATIBLE_FRAME", "both frames must use v0.3");
  if (left.anchor?.coordinate_reference !== right.anchor?.coordinate_reference) throw observationError("INCOMPATIBLE_FRAME", "coordinate references differ");
  const key = (item) => `${item.source_id}:${item.capability_id}`;
  const a = new Map(left.observations.map((item) => [key(item), item]));
  const b = new Map(right.observations.map((item) => [key(item), item]));
  const changes = [];
  for (const id of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const before = a.get(id);
    const after = b.get(id);
    if (!before) changes.push({ key: id, status: "ADDED", after: after.value });
    else if (!after) changes.push({ key: id, status: "REMOVED", before: before.value });
    else if (canonical(before.value) !== canonical(after.value) || before.units !== after.units) {
      changes.push({ key: id, status: "CHANGED", before: before.value, after: after.value, units_before: before.units, units_after: after.units, interpretation: "RECORDED_DIFFERENCE_NOT_AUTOMATICALLY_PHYSICAL_CHANGE" });
    }
  }
  const body = {
    schema: "connectordome.frame-delta/v0.3",
    left_frame_id: left.frame_id,
    right_frame_id: right.frame_id,
    changes,
    coverage_changed: canonical(left.coverage) !== canonical(right.coverage),
    reference_changed: left.anchor.anchor_id !== right.anchor.anchor_id,
    action_authority: ACTION_AUTHORITY,
  };
  return { ...body, delta_id: await sha256hex(canonical(body)) };
}

export function traceFrame(frame) {
  if (frame?.schema !== FRAME_VERSION) throw observationError("INCOMPATIBLE_FRAME", "frame must use v0.3");
  return {
    schema: "connectordome.frame-trace/v0.3",
    frame_id: frame.frame_id,
    anchor_id: frame.anchor.anchor_id,
    request: frame.request,
    included: frame.observations.map((item) => ({ source_id: item.source_id, capability_id: item.capability_id, measurement_time: item.measurement_time, retrieval_time: item.retrieval_time, connector_id: item.provenance?.connector_id || null, integrity_sha256: item.integrity?.sha256 || null, decision: "INCLUDED" })),
    excluded: frame.exclusions.map((item) => ({ ...item, decision: "EXCLUDED" })),
    coverage: frame.coverage,
    action_authority: ACTION_AUTHORITY,
  };
}
