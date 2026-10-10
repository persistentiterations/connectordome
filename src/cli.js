#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { inspectUrl, flattenFields } from "./core/inspect.js";
import { classifyOpenApi } from "./core/openapi.js";
import { previewEvent, simulationBody, textClaimBody } from "./core/builder.js";
import { buildPackage, manifestFromBuild } from "./core/package.js";
import { verifyConnector, formatCheckLines } from "./core/verify.js";
import { suggestFromDescription } from "./core/suggest.js";
import { canonical, sha256hex } from "./core/asf.js";

function help() {
  console.log(`dome — ConnectorDome CLI

  dome init [dir]
  dome inspect <url-or-file>
  dome run --kind web_api --url <url> --field temperature --capability weather.air.temperature --units C --data-type number
  dome verify <extracted-package-directory>
  dome test
  dome package ... (same flags as run; writes zip only after CONFORMANCE_PASS)
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
      source: path.basename(target),
      source_reference: "local-file (embedded when packaged)",
      content_type: "application/json",
      reachability: "OK",
      provenance_class: "TEST_FIXTURE",
      body,
      fields: flattenFields(body),
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

async function cmdRun(argv, asPackage) {
  const kind = arg("--kind", argv) || "web_api";
  const url = arg("--url", argv);
  const field = arg("--field", argv);
  const capability = arg("--capability", argv);
  const units = arg("--units", argv);
  const name = arg("--name", argv) || "example-connector";
  const mapping = { field, capability, units, time_field: arg("--time-field", argv), data_type: arg("--data-type", argv) || "number", freshness_threshold_s: Number(arg("--freshness-seconds", argv) || 300), observation_mode: argv.includes("--historical") ? "historical" : "current" };
  let inspection;
  if (kind === "simulator") {
    mapping.sim_seed = arg("--seed", argv) ?? 1;
    const b = simulationBody(mapping.sim_seed);
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
      inspection = { source: path.basename(url), source_reference: "local-file (embedded when packaged)", url: null, body, fields: flattenFields(body), reachability: "OK", provenance_class: "TEST_FIXTURE", connector_received_at: new Date().toISOString() };
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
  if (pkg.report.status !== "CONFORMANCE_PASS" || !pkg.zip) {
    console.error(pkg.check_text);
    console.error("HOLD — verified artifact was not issued");
    process.exitCode = 2;
    return;
  }
  const out = arg("--out", argv) || `${pkg.name}-0.1.2.zip`;
  fs.writeFileSync(out, pkg.zip);
  fs.writeFileSync(out.replace(/\.zip$/, ".receipt.json"), JSON.stringify({ ...pkg.report, package_hash: pkg.package_hash, content_digest: pkg.content_digest }, null, 2));
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
          version: "0.1.2",
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
    const target = path.resolve(argv[1] || "");
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error("verify requires an extracted package directory");
    const files = {};
    const bytes = {};
    const walk = (dir, prefix = "") => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const rel = prefix ? `${prefix}/${entry.name}` : entry.name; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, rel); else { bytes[rel] = fs.readFileSync(full); files[rel] = bytes[rel].toString("utf8"); } } };
    walk(target);
    const evidence = JSON.parse(files["verification.json"] || "null");
    if (!evidence?.files || !evidence?.content_digest) throw new Error("HOLD: verification.json missing or malformed");
    const observed = {};
    for (const name of Object.keys(bytes).filter((name) => name !== "verification.json").sort()) observed[name] = await sha256hex(bytes[name]);
    if (canonical(observed) !== canonical(evidence.files) || await sha256hex(canonical(observed)) !== evidence.content_digest) {
      console.error("HOLD: package content does not match verification.json");
      process.exit(2);
    }
    const manifest = JSON.parse(files["manifest.json"] || "null");
    const preview = { asf: JSON.parse(files["example-event.json"] || "null") };
    const report = verifyConnector({ manifest, files, preview });
    console.log(formatCheckLines(report));
    console.log("[PASS] content identity — verification.json matches extracted files");
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
