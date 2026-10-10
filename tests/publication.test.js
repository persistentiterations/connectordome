import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenFields } from "../src/core/inspect.js";
import { previewEvent } from "../src/core/builder.js";
import { buildPackage, manifestFromBuild } from "../src/core/package.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}

test("privacy terms security routes exist", () => {
  const privacy = read("public/privacy.html");
  const terms = read("public/terms.html");
  const security = read("public/security.html");
  assert.match(privacy, /DATA HANDLING — v0.1/);
  assert.match(privacy, /privacy@connectordome.com/);
  assert.match(privacy, /not used for model training/i);
  assert.match(privacy, /No advertising or analytics cookies/);
  assert.match(terms, /CONFORMANCE_PASS is not a safety certification/);
  assert.match(security, /security@connectordome.com/);
  assert.match(security, /SSRF bypasses/);
});

test("GitHub link present", () => {
  const index = read("public/index.html");
  assert.match(index, /https:\/\/github.com\/persistentiterations\/connectordome/);
  assert.match(read("public/docs.html"), /https:\/\/github.com\/persistentiterations\/connectordome/);
});

test("Apache-2.0 license file", () => {
  const lic = read("LICENSE");
  assert.match(lic, /Apache License/);
  assert.match(lic, /Version 2.0/);
  assert.match(lic, /Copyright 2026 BonAcqui LLC/);
  assert.equal(fs.existsSync(path.join(root, "LICENSE_HOLD.md")), false);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.license, "Apache-2.0");
});

test("guest package licensing metadata", async () => {
  const body = { temperature: 22.4, observed_at: "2026-08-31T12:00:00Z" };
  const inspection = {
    source: "example.org",
    url: "https://example.org/data.json",
    body,
    fields: flattenFields(body),
    reachability: "OK",
    connector_received_at: "2026-08-31T12:00:10Z",
  };
  const mapping = { field: "temperature", capability: "weather.air.temperature", units: "C", time_field: "observed_at" };
  const preview = await previewEvent({ inspection, mapping, kind: "web_api" });
  const manifest = manifestFromBuild({ kind: "web_api", name: "guest-weather", inspection, mapping, description: "" });
  assert.equal(manifest.generated_by, "ConnectorDome");
  assert.equal(manifest.generator_license, "Apache-2.0");
  assert.equal(manifest.license, "UNSPECIFIED");
  assert.equal(manifest.phone_home, false);
  assert.equal(manifest.demo, false);
  const pkg = await buildPackage({ manifest, preview, mapping, inspection });
  assert.match(pkg.files["LICENSE.md"], /UNSPECIFIED/);
  assert.equal(pkg.files["LICENSE.md"].includes("LICENSE_HOLD"), false);
  assert.match(pkg.files["adapter.mjs"], /No phone-home/);
  assert.equal(pkg.files["manifest.json"].includes("secret_value"), false);
  assert.equal(pkg.files["adapter.mjs"].includes("connectordome.com/api"), false);
});

test("chosen license is recorded not forced", async () => {
  const body = { n: 1 };
  const inspection = { source: "sim", body, reachability: "OK", connector_received_at: "t" };
  const mapping = { field: "n", capability: "count.n", units: "1", license: "MIT" };
  const preview = await previewEvent({ inspection, mapping, kind: "simulator" });
  const manifest = manifestFromBuild({ kind: "simulator", name: "s", inspection, mapping, description: "" });
  assert.equal(manifest.license, "MIT");
  const pkg = await buildPackage({ manifest, preview, mapping, inspection });
  assert.match(pkg.files["LICENSE.md"], /MIT/);
});

test("no phone-home or actuation regression", () => {
  const adapter = read("src/core/package.js");
  assert.match(adapter, /No phone-home/);
  assert.match(adapter, /GET only/);
  assert.doesNotMatch(adapter, /method: "POST"/);
});

test("steward wording", () => {
  assert.match(read("public/index.html"), /open-source project stewarded by BonAcqui LLC/);
  assert.match(read("NOTICE"), /BonAcqui LLC/);
});

test("open ecosystem wording stays factual and optional", () => {
  const docs = read("public/docs.html");
  assert.match(docs, /independently useful/i);
  assert.match(docs, /no functioning integration/i);
  assert.match(docs, /outside the immediate release scope/i);
  const readme = read("README.md");
  assert.match(readme, /disabled-by-default software simulation/i);
  assert.match(readme, /no required Fractalish, SymLan, ExoMCP, Anti-Illogical/i);
});

test("versioned ecosystem schemas are valid JSON", () => {
  for (const file of [
    "schemas/capability.v0.1alpha1.schema.json",
    "schemas/formation.v0.1alpha1.schema.json",
    "schemas/consequence-receipt.v0.1alpha1.schema.json",
    "schemas/extension.v0.1alpha1.schema.json",
  ]) {
    const schema = JSON.parse(read(file));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.ok(schema.$id.includes("v0.1alpha1"));
  }
});
