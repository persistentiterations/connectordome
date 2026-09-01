#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { inspectUrl } from "./core/inspect.js";
import { classifyOpenApi } from "./core/openapi.js";
import { previewEvent, simulationBody, textClaimBody } from "./core/builder.js";
import { buildPackage, manifestFromBuild } from "./core/package.js";
import { verifyConnector, formatCheckLines } from "./core/verify.js";
import { suggestFromDescription } from "./core/suggest.js";

function help() {
  console.log(`dome — ConnectorDome CLI

  dome init [dir]
  dome inspect <url-or-file>
  dome run --kind web_api --url <url> --field temperature --capability weather.air.temperature --units C
  dome verify <manifest.json>
  dome test
  dome package ... (same flags as run; writes zip)
  dome suggest "NOAA weather readings for Cleveland"

Do not use the name cd.
`);
}

function arg(flag, argv) {
  const i = argv.indexOf(flag);
  if (i >= 0) return argv[i + 1];
  return undefined;
}

async function loadFixture(rel) {
  const p = path.resolve(process.cwd(), rel);
  return fs.readFileSync(p, "utf8");
}

async function cmdInspect(target) {
  if (target && !target.startsWith("http") && fs.existsSync(target)) {
    const body = JSON.parse(fs.readFileSync(target, "utf8"));
    const inspection = {
      source: target,
      content_type: "application/json",
      reachability: "OK",
      provenance_class: "TEST_FIXTURE",
      body,
      fields: Object.entries(flatten(body)).map(([k, v]) => ({ path: k, value: v, type: typeof v })),
      connector_received_at: new Date().toISOString(),
    };
    console.log(JSON.stringify(inspection, null, 2));
    return;
  }
  const result = await inspectUrl(target, {
    fixtureLoader: async (rel) => loadFixture(rel),
  });
  console.log(JSON.stringify(result, null, 2));
}

function flatten(obj, prefix = "", out = {}) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  out[prefix] = obj;
  return out;
}

async function cmdRun(argv, asPackage) {
  const kind = arg("--kind", argv) || "web_api";
  const url = arg("--url", argv);
  const field = arg("--field", argv);
  const capability = arg("--capability", argv);
  const units = arg("--units", argv);
  const name = arg("--name", argv) || "example-connector";
  const mapping = { field, capability, units, time_field: arg("--time-field", argv) };
  let inspection;
  if (kind === "simulator") {
    const b = simulationBody(1);
    inspection = { source: "simulator", body: b, reachability: "OK", provenance_class: "SIMULATION", connector_received_at: new Date().toISOString() };
  } else if (kind === "text_claim") {
    const b = textClaimBody("battery = 73%", { charge_percent: 73 });
    inspection = { source: "operator", body: b, reachability: "OK", provenance_class: "TEXT_CLAIM", connector_received_at: new Date().toISOString() };
    mapping.field = mapping.field || "claimed.charge_percent";
    mapping.capability = mapping.capability || "text.claim.numeric";
  } else {
    if (!url) throw new Error("--url required");
    if (!url.startsWith("http") && fs.existsSync(url)) {
      const body = JSON.parse(fs.readFileSync(url, "utf8"));
      inspection = { source: url, url: null, body, reachability: "OK", provenance_class: "TEST_FIXTURE", connector_received_at: new Date().toISOString() };
    } else {
      inspection = await inspectUrl(url.startsWith("http") ? url : url, { fixtureLoader: loadFixture });
    }
  }
  const preview = await previewEvent({ inspection, mapping, kind: kind === "fixture" ? "fixture" : kind });
  const manifest = manifestFromBuild({ kind, name, inspection, mapping, description: "" });
  if (!asPackage) {
    console.log(JSON.stringify({ preview, manifest }, null, 2));
    return;
  }
  const pkg = await buildPackage({ manifest, preview, mapping, inspection });
  const out = arg("--out", argv) || `${pkg.name}-0.1.0.zip`;
  fs.writeFileSync(out, pkg.zip);
  fs.writeFileSync(out.replace(/\.zip$/, ".receipt.json"), JSON.stringify(pkg.report, null, 2));
  console.log(pkg.check_text);
  console.log(pkg.report.status);
  console.log("hash", pkg.package_hash);
  console.log("wrote", out);
}

async function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help") return help();
  if (cmd === "init") {
    const dir = path.resolve(argv[1] || "connector");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify(
        {
          name: path.basename(dir),
          version: "0.1.0",
          source_kind: "web_api",
          http_methods: ["GET"],
          actuation: "NONE",
          provenance_mode: "REMOTE_FEED",
          capabilities: [],
          unavailable_behavior: "UNAVAILABLE",
          no_fabrication: true,
        },
        null,
        2,
      ),
    );
    console.log(dir);
    return;
  }
  if (cmd === "inspect") return cmdInspect(argv[1]);
  if (cmd === "run") return cmdRun(argv.slice(1), false);
  if (cmd === "package") return cmdRun(argv.slice(1), true);
  if (cmd === "suggest") {
    console.log(JSON.stringify(suggestFromDescription(argv.slice(1).join(" ")), null, 2));
    return;
  }
  if (cmd === "verify") {
    const manifest = JSON.parse(fs.readFileSync(argv[1], "utf8"));
    const report = verifyConnector({ manifest, files: { "manifest.json": JSON.stringify(manifest) }, preview: { asf: { source_observed_at: null, connector_received_at: "", asf_ingested_at: "", action_authority: "NONE" } } });
    console.log(formatCheckLines(report));
    console.log(report.status);
    process.exit(report.status === "CONFORMANCE_PASS" ? 0 : 2);
  }
  if (cmd === "test") {
    console.log("run: npm test");
    return;
  }
  if (cmd === "openapi") {
    const spec = JSON.parse(fs.readFileSync(argv[1], "utf8"));
    console.log(JSON.stringify(classifyOpenApi(spec), null, 2));
    return;
  }
  help();
  process.exit(1);
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
