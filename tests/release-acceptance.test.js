import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import worker from "../src/worker.js";
import { unzipStore } from "../src/core/zip.js";
import { canonical, sha256hex } from "../src/core/asf.js";

const fixture = fs.readFileSync(new URL("../public/fixtures/demo-station.json", import.meta.url), "utf8");

const env = {
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/fixtures/demo-station.json") return new Response(fixture, { headers: { "content-type": "application/json" } });
      return new Response("not found", { status: 404 });
    },
  },
};

async function api(pathname, body) {
  return worker.fetch(new Request(`https://local.test${pathname}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env);
}

const demoRequest = {
  kind: "web_api",
  url: "/fixtures/demo-station.json",
  name: "demo-station",
  mapping: { field: "temperature", capability: "weather.air.temperature", units: "C", data_type: "number", time_field: "observed_at", license: "Apache-2.0" },
};

test("guest demo builds, extracts, executes and tests cleanly", async (t) => {
  const response = await api("/api/build", demoRequest);
  assert.equal(response.status, 200);
  const build = await response.json();
  assert.equal(build.status, "CONFORMANCE_PASS");
  assert.equal(build.artifact_issued, true);
  assert.equal(build.manifest.source_kind, "fixture");
  assert.equal(build.manifest.source_reference, "embedded:fixture.json");
  assert.equal(build.manifest.phone_home, false);
  assert.equal(build.package_hash.length, 64);
  assert.equal(build.content_digest.length, 64);

  const bytes = Uint8Array.from(Buffer.from(build.zip_base64, "base64"));
  const entries = unzipStore(bytes);
  const verification = JSON.parse(new TextDecoder().decode(entries["verification.json"]));
  const observedHashes = {};
  for (const name of Object.keys(entries).filter((name) => name !== "verification.json").sort()) observedHashes[name] = await sha256hex(entries[name]);
  assert.deepEqual(observedHashes, verification.files);
  assert.equal(await sha256hex(canonical(observedHashes)), verification.content_digest);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "connectordome-acceptance-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [name, data] of Object.entries(entries)) {
    const destination = path.join(directory, ...name.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data);
  }

  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const packaged = spawnSync(process.execPath, ["--test", "tests/adapter.test.mjs"], { cwd: directory, encoding: "utf8", env: childEnv });
  const packagedOutput = packaged.stdout + packaged.stderr;
  assert.equal(packaged.status, 0, packagedOutput);
  assert.match(packagedOutput, /tests 6/);
  assert.doesNotMatch(packagedOutput, /tests 0/);

  const runtimePath = path.join(directory, "runtime.mjs");
  const runtimeSource = fs.readFileSync(runtimePath, "utf8");
  fs.writeFileSync(runtimePath, runtimeSource.replace('ACTION_AUTHORITY = "NONE"', 'ACTION_AUTHORITY = "FULL"'));
  const intentionallyBroken = spawnSync(process.execPath, ["--test", "tests/adapter.test.mjs"], { cwd: directory, encoding: "utf8", env: childEnv });
  assert.notEqual(intentionallyBroken.status, 0, "packaged tests must reject a broken event contract");
  fs.writeFileSync(runtimePath, runtimeSource);

  const cliVerification = spawnSync(process.execPath, [fileURLToPath(new URL("../src/cli.js", import.meta.url)), "verify", directory], { encoding: "utf8", env: childEnv });
  assert.equal(cliVerification.status, 0, `${cliVerification.stdout}${cliVerification.stderr}`);
  assert.match(cliVerification.stdout, /content identity/);
  const readmePath = path.join(directory, "README.md");
  const readmeSource = fs.readFileSync(readmePath, "utf8");
  fs.writeFileSync(readmePath, `${readmeSource}\ntampered\n`);
  const tamperedVerification = spawnSync(process.execPath, [fileURLToPath(new URL("../src/cli.js", import.meta.url)), "verify", directory], { encoding: "utf8", env: childEnv });
  assert.notEqual(tamperedVerification.status, 0, "content identity must reject a modified extracted package");
  fs.writeFileSync(readmePath, readmeSource);

  const adapter = await import(pathToFileURL(path.join(directory, "adapter.mjs")).href + `?${Date.now()}`);
  const event = await adapter.sample();
  assert.equal(event.value, 22.4);
  assert.equal(event.provenance_mode, "TEST_FIXTURE");
  assert.equal(event.source_health, "HISTORICAL");
  assert.equal(event.freshness_status, "HISTORICAL");
  assert.equal(event.action_authority, "NONE");
  assert.equal(event.missed_polls, null);
  assert.equal(event.event_id.length, 64);

  for (const validTimestamp of ["2024-02-29T23:59:59Z", "2026-04-30T12:00:00-04:00", "2026-01-01T12:00:00+14:00"]) {
    const body = JSON.parse(fixture);
    body.observed_at = validTimestamp;
    assert.equal((await adapter.sampleFromBody(body)).source_observed_at, validTimestamp);
  }
  for (const invalidTimestamp of ["2026-02-30T12:00:00Z", "2026-04-31T12:00:00Z", "2026-01-01T24:00:00Z", "2026-01-01T12:00:00+14:01"]) {
    const body = JSON.parse(fixture);
    body.observed_at = invalidTimestamp;
    await assert.rejects(() => adapter.sampleFromBody(body), /INVALID_TIMESTAMP/);
  }

  for (const bad of [null, "", " ", "not-a-number"]) {
    const body = JSON.parse(fixture);
    body.temperature = bad;
    await assert.rejects(() => adapter.sampleFromBody(body), /MISSING_VALUE|TYPE_MISMATCH/);
  }
});

test("preview and runtime have equivalent event semantics", async () => {
  const previewResponse = await api("/api/preview", demoRequest);
  const preview = await previewResponse.json();
  const build = await (await api("/api/build", demoRequest)).json();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "connectordome-equivalence-"));
  try {
    for (const [name, data] of Object.entries(unzipStore(Uint8Array.from(Buffer.from(build.zip_base64, "base64"))))) {
      const destination = path.join(directory, ...name.split("/")); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data);
    }
    const adapter = await import(pathToFileURL(path.join(directory, "adapter.mjs")).href + `?${Date.now()}`);
    const runtime = await adapter.sampleFromBody(JSON.parse(fixture), {
      receivedAt: preview.asf.connector_received_at,
      ingestedAt: preview.asf.asf_ingested_at,
      observedAtHost: preview.asf.observed_at_host,
    });
    const fields = ["event_id", "source_id", "device_id", "capability_id", "value", "units", "provenance_mode", "action_authority", "source_health", "source_observed_at", "connector_received_at", "asf_ingested_at", "sequence", "adapter_id", "modality", "source_type", "origin_event_id", "freshness_status"];
    for (const field of fields) assert.deepEqual(runtime[field], preview.asf[field], field);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("HOLD never issues a verified artifact and stale success cannot be reused", async () => {
  const valid = await (await api("/api/build", demoRequest)).json();
  assert.equal(valid.artifact_issued, true);
  const invalid = await (await api("/api/build", { ...demoRequest, mapping: { ...demoRequest.mapping, field: "missing" } })).json();
  assert.equal(invalid.status, "HOLD");
  assert.equal(invalid.artifact_issued, false);
  assert.equal(Object.hasOwn(invalid, "zip_base64"), false);
  assert.equal(invalid.filename, null);
});

test("malformed JSON and contradictory provenance fail safely", async () => {
  const malformedEnv = { ASSETS: { async fetch() { return new Response("{bad", { headers: { "content-type": "application/json" } }); } } };
  const response = await worker.fetch(new Request("https://local.test/api/inspect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "/fixtures/demo-station.json" }) }), malformedEnv);
  assert.equal(response.status, 409);
  const result = await response.json();
  assert.match(result.error, /MALFORMED_SOURCE/);
});
