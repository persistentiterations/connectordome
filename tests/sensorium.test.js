import test from "node:test";
import assert from "node:assert/strict";
import { SOURCE_FAMILIES, validateSourceFamily } from "../src/core/sensorium.js";
import { buildObservationFrame, compareFrames, computeObservationIntegrity, resolveAnchor, traceFrame } from "../src/core/grounding.js";
import { DEMO_ANCHOR, demoFrameRequest, demoObservations } from "../src/core/ggr-fixtures.js";

test("three independently described source families have explicit permissions and read-only contracts", () => {
  assert.equal(SOURCE_FAMILIES.length, 3);
  for (const source of SOURCE_FAMILIES) assert.deepEqual(validateSourceFamily(source), { valid: true, errors: [] });
});

test("collective frame is reproducible, source-attributed, incomplete by design, and observation only", async () => {
  const first = await buildObservationFrame(await demoFrameRequest());
  const second = await buildObservationFrame(await demoFrameRequest());
  assert.equal(first.frame_id, second.frame_id);
  assert.equal(first.observations.length, 3);
  assert.equal(first.coverage.complete_world_measurement, false);
  assert.equal(first.action_authority, "NONE");
  assert.equal(first.simulated_conditions_present, true);
  assert.match(first.reconstruction_notice, /not a globally simultaneous/i);
});

for (const [scenario, expected] of [["unavailable", "UNAVAILABLE"], ["stale", "STALE"], ["invalid-timestamp", "INVALID_TIMESTAMP"], ["tampered", "TAMPERED"], ["incompatible-reference", "INCOMPATIBLE_REFERENCE"]]) {
  test(`frame preserves ${scenario} as an explicit exclusion`, async () => {
    const frame = await buildObservationFrame(await demoFrameRequest(scenario));
    assert.ok(frame.exclusions.some((item) => item.status === expected));
    assert.equal(frame.action_authority, "NONE");
  });
}

test("unavailable anchor fails rather than fabricating a frame", async () => {
  const request = await demoFrameRequest("anchor-unavailable");
  await assert.rejects(() => buildObservationFrame(request), { code: "REFERENCE_UNAVAILABLE" });
});

test("a simulated mobile anchor stays visibly simulated and gets a distinct anchor identity", async () => {
  const anchor = await resolveAnchor({ ...DEMO_ANCHOR, reference_id: "sim-mobile-robot", kind: "SIMULATED", position: { latitude: 40.708, longitude: -74.011 } });
  assert.equal(anchor.simulated, true);
  assert.notEqual(anchor.anchor_id, (await resolveAnchor(DEMO_ANCHOR)).anchor_id);
});

test("frame corrections make a new revision and delta rather than rewriting history", async () => {
  const oldFrame = await buildObservationFrame(await demoFrameRequest());
  const observations = await demoObservations();
  observations[2].value = 1.2;
  observations[2].integrity.sha256 = await computeObservationIntegrity(observations[2]);
  const corrected = await buildObservationFrame({ ...(await demoFrameRequest()), observations, frame_revision: 2, supersedes_frame_id: oldFrame.frame_id });
  const delta = await compareFrames(oldFrame, corrected);
  assert.notEqual(oldFrame.frame_id, corrected.frame_id);
  assert.equal(corrected.supersedes_frame_id, oldFrame.frame_id);
  assert.ok(delta.changes.some((change) => change.key === "sim-marine-buoy:ocean.water.level"));
  assert.equal(traceFrame(corrected).included.length, 3);
});
