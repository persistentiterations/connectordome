#!/usr/bin/env node
import { EXPERIMENTAL_CONTRACT_VERSION, FORMATION_VERSION } from "./contracts.js";
import { SimulatedEndpoint } from "./simulated-endpoint.js";
import { runFormation } from "./coordinator.js";
import { pathToFileURL } from "node:url";

const enabled = process.argv.includes("--enable-simulation");
const timestamp = "2026-10-10T12:00:00.000Z";

function capability(endpoint_id, capability_id, operations, initialState) {
  return [
    endpoint_id,
    new SimulatedEndpoint(
      {
        contract_version: EXPERIMENTAL_CONTRACT_VERSION,
        endpoint_id,
        owner_id: `owner:${endpoint_id}`,
        capability_id,
        operations,
        constraints: { max_observation_age_ms: 5_000 },
        authority: { mode: "LOCAL_EXPLICIT", default: "DENY" },
        safety: { local_interlock: true, safe_state: "STOPPED", blocked_operations: [] },
        health: { status: "AVAILABLE" },
        revocation: { supported: true },
      },
      { initialState, clock: () => timestamp },
    ),
  ];
}

export function referenceFormation() {
  const authority = (endpoint_id, operation) => ({
    endpoint_id,
    operations: [operation],
    expires_at: "2026-10-10T12:05:00.000Z",
  });
  return {
    formation_version: FORMATION_VERSION,
    formation_id: "demo-sort-001",
    correlation_id: "demo-run-001",
    steps: [
      { id: "sense", endpoint_id: "sensor-1", operation: "observe-item", effects: { item: "detected" }, authority: authority("sensor-1", "observe-item"), now: timestamp, observed_at: timestamp },
      { id: "position", endpoint_id: "lift-1", operation: "position-item", depends_on: ["sense"], effects: { position: "ready" }, authority: authority("lift-1", "position-item"), now: timestamp, observed_at: timestamp },
      { id: "route", endpoint_id: "gate-1", operation: "route-item", depends_on: ["position"], effects: { route: "bin-a" }, authority: authority("gate-1", "route-item"), now: timestamp, observed_at: timestamp },
    ],
  };
}

export function referenceEndpoints() {
  return new Map([
    capability("sensor-1", "demo.sensor", ["observe-item"], { item: "unknown" }),
    capability("lift-1", "demo.positioner", ["position-item"], { position: "home" }),
    capability("gate-1", "demo.router", ["route-item"], { route: "neutral" }),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runFormation(referenceFormation(), referenceEndpoints(), { featureEnabled: enabled });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "PASS" ? 0 : 2;
}
