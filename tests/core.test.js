import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PROVENANCE_MODES, assignEventId, receptorEvent, assertProvenanceAllowed } from "../src/core/asf.js";
import { hostnameBlocked, assertPublicHttpsUrl, assertResolvedAddressesPublic } from "../src/core/ssrf.js";
import { flattenFields, inspectUrl, getByPath } from "../src/core/inspect.js";
import { classifyOpenApi } from "../src/core/openapi.js";
import { mapField, previewEvent, simulationBody, textClaimBody } from "../src/core/builder.js";
import { verifyConnector } from "../src/core/verify.js";
import { buildPackage, manifestFromBuild } from "../src/core/package.js";
import { searchRegistry, getConnector } from "../src/core/registry.js";
import { zipStore } from "../src/core/zip.js";
import { normalizeObservation, parseSourceTime } from "../src/core/observation.js";
import { suggestFromDescription } from "../src/core/suggest.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "public/fixtures/demo-station.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function insp(body, extra = {}) {
  return {
    source: "example.org",
    url: "https://example.org/data.json",
    body,
    fields: flattenFields(body),
    reachability: "OK",
    provenance_class: "REMOTE_FEED",
    connector_received_at: "2026-08-31T12:00:10Z",
    ...extra,
  };
}

test("homepage copy", () => {
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  assert.match(html, /Connect the world to AI/i);
  assert.match(html, /Build a connector/i);
  assert.match(html, /Browse connectors/i);
  assert.match(html, /What is ASF/i);
  assert.match(html, /1 CONNECT/);
  assert.match(html, /2 MAP/);
  assert.match(html, /3 USE/);
  assert.match(html, /ONE INTERFACE TO OBSERVE/);
});

test("JSON source parsing", () => {
  const fields = flattenFields(fixture);
  const names = fields.map((f) => f.path);
  assert.ok(names.includes("temperature"));
  assert.equal(fields.find((f) => f.path === "temperature").value, 22.4);
});

test("OpenAPI read vs mutate", () => {
  const c = classifyOpenApi({
    openapi: "3.1.0",
    info: { title: "x" },
    paths: {
      "/t": { get: { summary: "read" }, post: { summary: "write" }, delete: { summary: "no" } },
    },
  });
  assert.equal(c.included.length, 1);
  assert.equal(c.included[0].method, "GET");
  assert.ok(c.excluded.some((e) => e.reason.includes("MUTATING")));
  assert.equal(c.mutating_operations_exposed, false);
});

test("mapping and ReceptorEvent REMOTE_FEED", async () => {
  const inspection = insp(fixture);
  const preview = await previewEvent({
    inspection,
    mapping: { field: "temperature", capability: "weather.air.temperature", units: "C", time_field: "observed_at" },
    kind: "web_api",
  });
  assert.equal(preview.asf.provenance_mode, "REMOTE_FEED");
  assert.equal(preview.asf.value, 22.4);
  assert.equal(preview.asf.units, "C");
  assert.equal(preview.asf.action_authority, "NONE");
  assert.equal(preview.asf.source_observed_at, "2026-08-31T12:00:00Z");
  assert.ok(preview.asf.connector_received_at);
  assert.ok(preview.asf.asf_ingested_at);
  assert.notEqual(preview.asf.connector_received_at, preview.asf.source_observed_at);
  assert.ok(preview.asf.event_id.length === 64);
});

test("SIMULATION provenance", async () => {
  const body = simulationBody(1);
  const preview = await previewEvent({
    inspection: insp(body, { source: "simulator", provenance_class: "SIMULATION" }),
    mapping: { field: "charge_percent", capability: "battery.charge_percent", units: "percent" },
    kind: "simulator",
  });
  assert.equal(preview.asf.provenance_mode, "SIMULATION");
});

test("TEXT_CLAIM provenance", async () => {
  const body = textClaimBody("battery = 73%", { charge_percent: 73 });
  const preview = await previewEvent({
    inspection: insp(body, { source: "operator", provenance_class: "TEXT_CLAIM" }),
    mapping: { field: "claimed.charge_percent", capability: "text.claim.numeric", units: "percent" },
    kind: "text_claim",
  });
  assert.equal(preview.asf.provenance_mode, "TEXT_CLAIM");
});

test("TEST_FIXTURE provenance", async () => {
  const preview = await previewEvent({
    inspection: insp(fixture, { source: "local-file", provenance_class: "TEST_FIXTURE" }),
    mapping: { field: "temperature", capability: "weather.air.temperature", units: "C" },
    kind: "fixture",
  });
  assert.equal(preview.asf.provenance_mode, "TEST_FIXTURE");
});

test("remote cannot claim LIVE_LOCAL", () => {
  assert.throws(() => assertProvenanceAllowed("web_api", "LIVE_LOCAL"));
  assert.throws(() => assertProvenanceAllowed("simulator", "REMOTE_FEED"));
  assert.throws(() => assertProvenanceAllowed("fixture", "LIVE_LOCAL"));
});

test("read-only enforcement", () => {
  const report = verifyConnector({
    manifest: {
      name: "n",
      source_kind: "web_api",
      provenance_mode: "REMOTE_FEED",
      http_methods: ["POST"],
      actuation: "NONE",
      capabilities: [{ units: "C" }],
      unavailable_behavior: "UNAVAILABLE",
      no_fabrication: true,
    },
    files: { "adapter.mjs": "fetch(url,{method:'POST'})" },
    preview: { asf: { source_observed_at: null, connector_received_at: "t", asf_ingested_at: "t", action_authority: "NONE" } },
  });
  assert.equal(report.status, "HOLD");
  assert.ok(report.mutating_operations_exposed.length);
});

test("secret redaction", () => {
  const report = verifyConnector({
    manifest: {
      name: "n",
      source_kind: "web_api",
      provenance_mode: "REMOTE_FEED",
      http_methods: ["GET"],
      actuation: "NONE",
      capabilities: [{ units: null }],
      unavailable_behavior: "UNAVAILABLE",
      no_fabrication: true,
      secret_ref: "user-config:token",
    },
    files: { "manifest.json": '{"secret_value":"abcd1234secret"}' },
    preview: { asf: { source_observed_at: null, connector_received_at: "t", asf_ingested_at: "t", action_authority: "NONE" } },
  });
  assert.equal(report.status, "HOLD");
});

test("SSRF protection", () => {
  assert.equal(hostnameBlocked("127.0.0.1"), true);
  assert.equal(hostnameBlocked("10.0.0.5"), true);
  assert.equal(hostnameBlocked("169.254.169.254"), true);
  assert.equal(hostnameBlocked("localhost"), true);
  assert.equal(hostnameBlocked("metadata.google.internal"), true);
  assert.equal(hostnameBlocked("example.org"), false);
  assert.throws(() => assertPublicHttpsUrl("http://example.org/x"));
  assert.throws(() => assertPublicHttpsUrl("https://127.0.0.1/"));
  assert.throws(() => assertPublicHttpsUrl("https://192.168.1.9/"));
  assert.throws(() => assertPublicHttpsUrl("https://2130706433/"));
  assert.throws(() => assertPublicHttpsUrl("https://0x7f000001/"));
  assert.throws(() => assertPublicHttpsUrl("https://0177.0.0.1/"));
  assert.throws(() => assertPublicHttpsUrl("https://[::ffff:127.0.0.1]/"));
  assert.throws(() => assertResolvedAddressesPublic(["93.184.216.34", "127.0.0.1"]));
});

test("strict numeric normalization never fabricates zero", () => {
  assert.equal(normalizeObservation(0, "number"), 0);
  assert.equal(normalizeObservation("12.5", "number"), 12.5);
  for (const value of [null, "", " ", " 1", "NaN", "Infinity", true, {}, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => normalizeObservation(value, "number"));
  }
});

test("invalid mapping declarations fail clearly", async () => {
  assert.throws(() => mapField(insp({ n: 1 }), { field: "n", capability: "", data_type: "number" }), /MALFORMED_CONFIGURATION/);
  assert.throws(() => mapField(insp({ n: 1 }), { field: "n", capability: "count.n", data_type: "decimal" }), /INVALID_DATA_TYPE/);
  assert.throws(() => parseSourceTime("not-a-time"), /INVALID_TIMESTAMP/);
  await assert.rejects(() => previewEvent({ inspection: insp({ n: 1, when: "not-a-time" }), mapping: { field: "n", capability: "count.n", data_type: "number", time_field: "when" }, kind: "web_api" }), /INVALID_TIMESTAMP/);
});

test("source timestamps require real calendar dates, clocks, and offsets", () => {
  const valid = [
    "2024-02-29T23:59:59Z",
    "2000-02-29T00:00:00.123456Z",
    "1900-02-28T12:30:45+05:30",
    "2026-04-30T00:00:00-04:00",
    "2026-12-31T23:59:59+14:00",
    "2026-01-01T00:00:00-00:00",
  ];
  for (const timestamp of valid) assert.equal(parseSourceTime(timestamp), timestamp);

  const invalid = [
    "2026-02-29T12:00:00Z",
    "2026-02-30T12:00:00Z",
    "1900-02-29T12:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-00-01T12:00:00Z",
    "2026-13-01T12:00:00Z",
    "2026-01-00T12:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T23:60:00Z",
    "2026-01-01T23:59:60Z",
    "2026-01-01T12:00:00+14:01",
    "2026-01-01T12:00:00+15:00",
    "2026-01-01T12:00:00+05:60",
    "2026-01-01T12:00:00",
  ];
  for (const timestamp of invalid) assert.throws(() => parseSourceTime(timestamp), /INVALID_TIMESTAMP/, timestamp);
});

test("literal dots in field names use escaped paths", () => {
  const body = { "sensor.temp": 18.5, nested: { "a.b": 2 } };
  assert.equal(getByPath(body, "sensor\\.temp"), 18.5);
  assert.equal(getByPath(body, "nested.a\\.b"), 2);
  assert.ok(flattenFields(body).some((field) => field.path === "sensor\\.temp"));
});

test("simulator seed zero is deterministic and distinct", () => {
  assert.equal(simulationBody(0).n, 0);
  assert.equal(simulationBody(0).charge_percent, 50);
  assert.deepEqual(simulationBody(-3), simulationBody(3));
});

test("packaged simulator preserves seed zero", async () => {
  const body = simulationBody(0);
  const inspection = { source: "simulator", body, fields: flattenFields(body), reachability: "OK", provenance_class: "SIMULATION", connector_received_at: "2026-01-01T00:00:01.000Z" };
  const mapping = { field: "n", capability: "simulation.seed", units: "1", data_type: "number", sim_seed: 0 };
  const preview = await previewEvent({ inspection, mapping, kind: "simulator" });
  const manifest = manifestFromBuild({ kind: "simulator", name: "seed-zero", inspection, mapping, description: "" });
  const pkg = await buildPackage({ manifest, preview, mapping, inspection });
  assert.equal(pkg.report.status, "CONFORMANCE_PASS");
  assert.match(pkg.files["manifest.json"], /"sim_seed": 0/);
});

test("malformed OpenAPI documents are rejected", () => {
  assert.throws(() => classifyOpenApi({ paths: {} }), /openapi or swagger/);
  assert.throws(() => classifyOpenApi({ openapi: "3.1.0", paths: [] }), /paths object/);
  assert.throws(() => classifyOpenApi({ openapi: "3.1.0", paths: { "/x": { get: "bad" } } }), /invalid OpenAPI operation/);
});

test("schema drift does not fabricate", async () => {
  const preview = await previewEvent({
    inspection: insp({ humidity: 61 }),
    mapping: { field: "temperature", capability: "weather.air.temperature", units: "C" },
    kind: "web_api",
  });
  assert.equal(preview.schema_drift, true);
  assert.equal(preview.asf, null);
});

test("source unavailable inspect", async () => {
  const result = await inspectUrl("https://example.org/missing.json", {
    fetchImpl: async () => new Response("no", { status: 404, headers: { "content-type": "text/plain" } }),
  });
  assert.equal(result.reachability, "UNAVAILABLE");
  assert.equal(result.body, null);
});

test("timestamp separation", async () => {
  const preview = await previewEvent({
    inspection: insp(fixture),
    mapping: { field: "temperature", capability: "weather.air.temperature", units: "C", time_field: "observed_at" },
    kind: "web_api",
  });
  const e = preview.asf;
  assert.ok("source_observed_at" in e && "connector_received_at" in e && "asf_ingested_at" in e);
  assert.equal(Object.prototype.hasOwnProperty.call(e, "timestamp"), false);
});

test("DNS and redirect SSRF defenses use controlled fixtures", async () => {
  await assert.rejects(
    () => inspectUrl("https://public.example/data", { fetchImpl: async () => new Response("{}", { headers: { "content-type": "application/json" } }), resolveHost: async () => ["10.0.0.8"] }),
    /SSRF_BLOCKED/,
  );
  await assert.rejects(
    () => inspectUrl("https://public.example/data", { fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } }) }),
    /SSRF_BLOCKED/,
  );
});

test("freshness distinguishes fresh stale historical and unknown", async () => {
  const base = { source: "example.org", url: "https://example.org/data.json", reachability: "OK", provenance_class: "REMOTE_FEED", connector_received_at: "2026-01-01T00:10:00.000Z" };
  const make = (body, mapping) => previewEvent({ inspection: { ...base, body, fields: flattenFields(body) }, mapping: { field: "value", capability: "example.value", data_type: "number", ...mapping }, kind: "web_api" });
  assert.equal((await make({ value: 1, at: "2026-01-01T00:09:59.000Z" }, { time_field: "at", freshness_threshold_s: 60 })).asf.freshness_status, "FRESH");
  assert.equal((await make({ value: 1, at: "2026-01-01T00:00:00.000Z" }, { time_field: "at", freshness_threshold_s: 60 })).asf.freshness_status, "STALE");
  assert.equal((await make({ value: 1, at: "2020-01-01T00:00:00.000Z" }, { time_field: "at", observation_mode: "historical" })).asf.freshness_status, "HISTORICAL");
  const unknown = (await make({ value: 1 }, {})).asf;
  assert.equal(unknown.freshness_status, "UNKNOWN");
  assert.equal(unknown.missed_polls, null);
});

test("unit transformation receipt stays explicit", async () => {
  const preview = await previewEvent({
    inspection: insp(fixture),
    mapping: { field: "temperature", capability: "weather.air.temperature", units: "C" },
    kind: "web_api",
  });
  assert.equal(preview.asf.units, "C");
});

test("package generation hash and verify", async () => {
  const inspection = insp(fixture, { url: "https://connectordome.com/fixtures/demo-station.json" });
  const mapping = { field: "temperature", capability: "weather.air.temperature", units: "C", time_field: "observed_at" };
  const preview = await previewEvent({ inspection, mapping, kind: "web_api" });
  const manifest = manifestFromBuild({ kind: "web_api", name: "demo-station", inspection, mapping, description: "demo" });
  const pkg = await buildPackage({ manifest, preview, mapping, inspection });
  assert.equal(pkg.report.status, "CONFORMANCE_PASS");
  assert.equal(pkg.package_hash.length, 64);
  assert.ok(pkg.files["manifest.json"].includes("secret_value") === false);
  assert.ok(pkg.zip.length > 100);
  const again = zipStore(pkg.files);
  const { sha256hex } = await import("../src/core/asf.js");
  assert.equal(await sha256hex(again), pkg.package_hash);
});

test("generated adapter SCHEMA_DRIFT and UNAVAILABLE", async () => {
  const inspection = insp(fixture, { url: "https://example.org/data.json" });
  const mapping = { field: "temperature", capability: "weather.air.temperature", units: "C" };
  const preview = await previewEvent({ inspection, mapping, kind: "web_api" });
  const manifest = manifestFromBuild({ kind: "web_api", name: "x", inspection, mapping, description: "" });
  const pkg = await buildPackage({ manifest, preview, mapping, inspection });
  const dir = path.join(root, ".tmp-adapter-test");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "adapter.mjs"), pkg.files["adapter.mjs"]);
  fs.writeFileSync(path.join(dir, "runtime.mjs"), pkg.files["runtime.mjs"]);
  const { sample } = await import(pathToFileURL(path.join(dir, "adapter.mjs")).href + `?t=${Date.now()}`);
  await assert.rejects(() => sample(async () => ({ ok: false })), /UNAVAILABLE/);
  await assert.rejects(() => sample(async () => ({ ok: true, json: async () => ({ temp: 1 }) })), /SCHEMA_DRIFT/);
  const ev = await sample(async () => ({ ok: true, json: async () => fixture }));
  assert.equal(ev.value, 22.4);
  assert.equal(ev.action_authority, "NONE");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("registry demo only", () => {
  const all = searchRegistry();
  assert.ok(all.length >= 1);
  assert.ok(all.every((c) => c.demo && c.status === "DEMO"));
  assert.equal(getConnector("demo-station").provenance_mode, "TEST_FIXTURE");
});

test("no actuation surface in source", () => {
  const files = [];
  function walk(d) {
    for (const n of fs.readdirSync(d)) {
      if (n === "node_modules" || n === ".wrangler") continue;
      const p = path.join(d, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(js|html|mjs)$/.test(n)) files.push(fs.readFileSync(p, "utf8"));
    }
  }
  walk(path.join(root, "src"));
  walk(path.join(root, "public"));
  const blob = files.join("\n");
  assert.equal(blob.includes("def execute("), false);
  assert.equal(/actuation"\s*:\s*"WRITE"/.test(blob), false);
});

test("suggestions are not authority", () => {
  const s = suggestFromDescription("NOAA weather readings for Cleveland");
  assert.equal(s.authority, false);
});

test("event identity stable", async () => {
  const ev = receptorEvent({
    source_id: "s",
    capability_id: "c",
    source_type: "web_api",
    value: 1,
    provenance_mode: "REMOTE_FEED",
    observed_at_host: "2026-01-01T00:00:00.000Z",
    connector_received_at: "2026-01-01T00:00:00.000Z",
    asf_ingested_at: "2026-01-01T00:00:00.000Z",
  });
  const a = await assignEventId(ev);
  const b = await assignEventId(ev);
  assert.equal(a.event_id, b.event_id);
});

test("required provenance modes exist", () => {
  for (const m of ["LIVE_LOCAL", "REMOTE_FEED", "TEST_FIXTURE", "SIMULATION", "REPLAY", "TEXT_CLAIM"]) {
    assert.ok(PROVENANCE_MODES.includes(m));
  }
});

test("builder html exists", () => {
  const html = fs.readFileSync(path.join(root, "public/build.html"), "utf8");
  assert.match(html, /WEB API/);
  assert.match(html, /deferred; not implemented/i);
});
