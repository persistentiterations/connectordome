/** Deterministic demonstration fixtures; all observations are visibly simulated. SPDX-License-Identifier: Apache-2.0 */
import { computeObservationIntegrity } from "./grounding.js";

export const DEMO_ANCHOR = {
  reference_id: "demo-lower-manhattan",
  kind: "FIXED_TERRESTRIAL",
  coordinate_reference: "EPSG:4326",
  position: { latitude: 40.7075, longitude: -74.0125 },
  spatial_uncertainty_m: 15,
  time_basis: { scale: "UTC", uncertainty_ms: 50 },
  validity: { from: "2026-10-15T00:00:00Z", to: "2026-10-17T00:00:00Z" },
  provenance: { mode: "SIMULATION", note: "Deterministic demonstration reference; not a surveyed production reference." }
};

const base = [
  { source_id: "sim-weather-station", capability_id: "weather.air.temperature", value: 18.4, units: "Cel", measurement_time: "2026-10-16T12:00:00Z", retrieval_time: "2026-10-16T12:00:10Z", position: { latitude: 40.6398, longitude: -73.7789 }, reference: { coordinate_reference: "EPSG:4326" }, spatial_uncertainty_m: 30, temporal_uncertainty_ms: 1000, quality: { status: "SIMULATED" }, provenance: { mode: "SIMULATION", connector_id: "demo.nws" }, permissions: { permitted_uses: ["research", "inference"] } },
  { source_id: "sim-river-gauge", capability_id: "water.streamflow", value: 121.7, units: "ft3/s", measurement_time: "2026-10-16T11:58:00Z", retrieval_time: "2026-10-16T12:00:12Z", position: { latitude: 40.5000, longitude: -74.2500 }, reference: { coordinate_reference: "EPSG:4326" }, spatial_uncertainty_m: 25, temporal_uncertainty_ms: 60000, quality: { status: "SIMULATED", provisional: true }, provenance: { mode: "SIMULATION", connector_id: "demo.usgs" }, permissions: { permitted_uses: ["research", "inference"] } },
  { source_id: "sim-marine-buoy", capability_id: "ocean.water.level", value: 1.116, units: "m", measurement_time: "2026-10-16T11:59:00Z", retrieval_time: "2026-10-16T12:00:08Z", position: { latitude: 40.7006, longitude: -74.0142 }, reference: { coordinate_reference: "EPSG:4326" }, spatial_uncertainty_m: 10, temporal_uncertainty_ms: 30000, quality: { status: "SIMULATED", publisher_flag: "p" }, provenance: { mode: "SIMULATION", connector_id: "demo.coops" }, permissions: { permitted_uses: ["research", "inference"] } }
];

export async function demoObservations(scenario = "nominal") {
  const observations = structuredClone(base);
  if (scenario === "unavailable") observations[1] = { source_id: "sim-river-gauge", capability_id: "water.streamflow", availability: "UNAVAILABLE", unavailable_reason: "simulated upstream outage" };
  if (scenario === "stale") observations[1].measurement_time = "2026-10-16T09:00:00Z";
  if (scenario === "invalid-timestamp") observations[1].measurement_time = "2026-02-30T12:00:00Z";
  if (scenario === "incompatible-reference") observations[2].reference.coordinate_reference = "LOCAL:DEMO";
  if (scenario === "tampered") observations[0].value = 99.9;
  for (const observation of observations) {
    if (observation.availability === "UNAVAILABLE") continue;
    observation.integrity = { sha256: await computeObservationIntegrity(observation), algorithm: "SHA-256" };
  }
  if (scenario === "tampered") observations[0].value = 18.4;
  return observations;
}

export async function demoFrameRequest(scenario = "nominal") {
  return { anchor: scenario === "anchor-unavailable" ? { ...DEMO_ANCHOR, validity: { from: "2027-01-01T00:00:00Z" } } : DEMO_ANCHOR, target_time: "2026-10-16T12:00:00Z", temporal_tolerance_s: 600, expected_sources: base.map((item) => item.source_id), observations: await demoObservations(scenario) };
}
