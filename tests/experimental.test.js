import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPERIMENTAL_CONTRACT_VERSION, FORMATION_VERSION } from "../src/experimental/contracts.js";
import { SimulatedEndpoint } from "../src/experimental/simulated-endpoint.js";
import { runFormation } from "../src/experimental/coordinator.js";
import { verifyConsequenceReceipt } from "../src/experimental/receipts.js";
import { referenceEndpoints, referenceFormation } from "../src/experimental/demo.js";

const NOW = "2026-10-10T12:00:00.000Z";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function contract(overrides = {}) {
  return {
    contract_version: EXPERIMENTAL_CONTRACT_VERSION,
    endpoint_id: "endpoint-1",
    owner_id: "owner-1",
    capability_id: "demo.operation",
    operations: ["operate"],
    constraints: { max_observation_age_ms: 1_000 },
    authority: { mode: "LOCAL_EXPLICIT", default: "DENY" },
    safety: { local_interlock: true, safe_state: "STOPPED", blocked_operations: [] },
    health: { status: "AVAILABLE" },
    revocation: { supported: true },
    ...overrides,
  };
}

function step(overrides = {}) {
  return {
    id: "step-1",
    endpoint_id: "endpoint-1",
    operation: "operate",
    effects: { value: 1 },
    authority: { endpoint_id: "endpoint-1", operations: ["operate"], expires_at: "2026-10-10T12:01:00.000Z" },
    now: NOW,
    observed_at: NOW,
    ...overrides,
  };
}

function spec(steps = [step()]) {
  return { formation_version: FORMATION_VERSION, formation_id: "f-1", correlation_id: "c-1", steps };
}

async function runWith(endpoint, formation = spec()) {
  return runFormation(formation, new Map([[endpoint.contract.endpoint_id, endpoint]]), { featureEnabled: true });
}

test("three-endpoint reference formation completes and dissolves", async () => {
  const result = await runFormation(referenceFormation(), referenceEndpoints(), { featureEnabled: true });
  assert.equal(result.status, "PASS");
  assert.equal(result.phase, "DISSOLVED");
  assert.equal(result.receipts.length, 3);
  assert.ok(result.receipts.every((r) => r.evidence_mode === "SIMULATION"));
  assert.deepEqual(result.receipts.map((r) => r.receipt_id), ["demo-run-001:sense", "demo-run-001:position", "demo-run-001:route"]);
  assert.equal(new Set(result.receipts.map((r) => r.receipt_id)).size, 3);
});

test("checked-in reference receipt matches deterministic demo", async () => {
  const expected = JSON.parse(fs.readFileSync(path.join(root, "artifacts/CONNECTORDOME_EXPERIMENTAL_V0_1ALPHA1/REFERENCE_DEMO_RECEIPT.json"), "utf8"));
  const actual = await runFormation(referenceFormation(), referenceEndpoints(), { featureEnabled: true });
  assert.deepEqual(actual, expected);
});

test("experimental path is disabled by default", async () => {
  const result = await runFormation(referenceFormation(), referenceEndpoints());
  assert.deepEqual([result.status, result.phase], ["HOLD", "FEATURE_FLAG"]);
});

test("permission refusal is locally non-bypassable", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { clock: () => NOW });
  const result = await runWith(endpoint, spec([step({ authority: { endpoint_id: "endpoint-1", operations: [], expires_at: "2026-10-10T12:01:00.000Z" } })]));
  assert.equal(result.status, "HOLD");
  assert.equal(result.receipts[0].reported_outcome, "PERMISSION_REFUSED");
});

test("missing expiry is refused", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { clock: () => NOW });
  const result = await runWith(endpoint, spec([step({ authority: { endpoint_id: "endpoint-1", operations: ["operate"] } })]));
  assert.equal(result.receipts[0].reported_outcome, "PERMISSION_EXPIRED");
});

test("stale observation holds", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { clock: () => NOW });
  const result = await runWith(endpoint, spec([step({ observed_at: "2026-10-10T11:59:00.000Z" })]));
  assert.equal(result.receipts[0].reported_outcome, "STALE_OBSERVATION");
});

test("future observation holds", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { clock: () => NOW });
  const result = await runWith(endpoint, spec([step({ observed_at: "2026-10-10T12:00:01.000Z" })]));
  assert.equal(result.receipts[0].reported_outcome, "STALE_OBSERVATION");
});

test("lost communication holds", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { connected: false, clock: () => NOW });
  const result = await runWith(endpoint);
  assert.equal(result.receipts[0].reported_outcome, "LOST_COMMUNICATION");
});

test("conflicting commands hold before a second proposal", async () => {
  const endpoint = new SimulatedEndpoint(contract({ operations: ["operate", "reverse"] }), { clock: () => NOW });
  const second = step({ id: "step-2", operation: "reverse", conflicts_with: ["operate"], authority: { endpoint_id: "endpoint-1", operations: ["reverse"], expires_at: "2026-10-10T12:01:00.000Z" } });
  const result = await runWith(endpoint, spec([step(), second]));
  assert.deepEqual([result.status, result.phase, result.receipts.length], ["HOLD", "CONFLICT", 1]);
});

test("endpoint unavailability holds", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { available: false, clock: () => NOW });
  const result = await runWith(endpoint);
  assert.equal(result.receipts[0].reported_outcome, "ENDPOINT_UNAVAILABLE");
});

test("revocation holds", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { revoked: true, clock: () => NOW });
  const result = await runWith(endpoint);
  assert.equal(result.receipts[0].reported_outcome, "AUTHORITY_REVOKED");
});

test("interruption transitions to endpoint safe state", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { interrupted: true, clock: () => NOW });
  const result = await runWith(endpoint);
  assert.equal(result.receipts[0].reported_outcome, "INTERRUPTED_SAFE_STATE");
  assert.equal(result.receipts[0].observed_consequence.mode, "STOPPED");
});

test("inconsistent consequence report fails verification", async () => {
  const endpoint = new SimulatedEndpoint(contract(), { clock: () => NOW });
  const result = await runWith(endpoint);
  const tampered = { ...result.receipts[0], observed_consequence: { value: 999 } };
  assert.equal((await verifyConsequenceReceipt(tampered)).status, "HOLD");
});

test("unsafe operation holds at endpoint interlock", async () => {
  const endpoint = new SimulatedEndpoint(contract({ safety: { local_interlock: true, safe_state: "STOPPED", blocked_operations: ["operate"] } }), { clock: () => NOW });
  const result = await runWith(endpoint);
  assert.equal(result.receipts[0].reported_outcome, "UNSAFE_OPERATION");
});
