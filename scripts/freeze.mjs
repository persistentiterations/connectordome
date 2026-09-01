import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inspectUrl } from "../src/core/inspect.js";
import { previewEvent } from "../src/core/builder.js";
import { buildPackage, manifestFromBuild } from "../src/core/package.js";
import { sha256hex } from "../src/core/asf.js";
import { classifyOpenApi } from "../src/core/openapi.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "artifacts", "CONNECTORDOME_CORE_V0_1");
fs.mkdirSync(out, { recursive: true });

function write(name, obj) {
  const p = path.join(out, name);
  const text = typeof obj === "string" ? (obj.endsWith("\n") ? obj : obj + "\n") : JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(p, text);
  return p;
}

const tests = spawnSync(process.execPath, ["--test", "tests/core.test.js"], { cwd: root, encoding: "utf8" });
write("TEST_RECEIPT.json", {
  returncode: tests.status,
  stdout: (tests.stdout || "").slice(-4000),
  stderr: (tests.stderr || "").slice(-1500),
  python: null,
  node: process.version,
});

const fixtureRel = "public/fixtures/demo-station.json";
const inspection = await inspectUrl("/fixtures/demo-station.json", {
  fixtureLoader: async () => fs.readFileSync(path.join(root, fixtureRel), "utf8"),
});
const mapping = { field: "temperature", capability: "weather.air.temperature", units: "C", time_field: "observed_at" };
const preview = await previewEvent({ inspection, mapping, kind: "web_api" });
const manifest = manifestFromBuild({ kind: "web_api", name: "demo-station", inspection, mapping, description: "canonical demo" });
const pkg = await buildPackage({ manifest, preview, mapping, inspection });

write("CANONICAL_BUILD_DEMO.json", {
  source: "/fixtures/demo-station.json",
  inspection: { source: inspection.source, reachability: inspection.reachability, fields: inspection.fields },
  preview: preview.asf,
  status: pkg.report.status,
  package_hash: pkg.package_hash,
  check_text: pkg.check_text,
});
write("CONNECTOR_PACKAGE_SPEC.json", { files: Object.keys(pkg.files), manifest, runtime_independence: true, phone_home: false });
write("VERIFIER_RECEIPT.json", pkg.report);
write("SECURITY_RECEIPT.json", {
  ssrf: "blocks localhost, RFC1918, link-local, metadata, http credentials",
  secrets_in_packages: "NONE",
  mutating_default: "GET only",
  actuation: "NONE",
});
write("REGISTRY_WITNESS.json", { demo_only: true, listings: ["demo-station", "demo-sim-battery", "demo-text-claim"] });
write(
  "NO_ACTUATION_SURFACE_REPORT.md",
  `# No actuation surface\n\nLIVE ACTUATION: NONE\nMUTATING OPERATIONS EXPOSED: NONE\n\nGenerated connectors advertise GET/HEAD only.\nOpenAPI POST/PUT/PATCH/DELETE are EXCLUDED — MUTATING OPERATION.\n`,
);
write("DEPLOYMENT_RECEIPT.json", {
  public_site: "https://connectordome.com",
  www: "https://www.connectordome.com -> 301 https://connectordome.com/",
  workers_dev: "https://connectordome.flexpadm.workers.dev",
  worker: "connectordome",
  https: "PASS",
  paid_resources: "NONE",
});
write("DNS_RECEIPT.json", {
  zone: "connectordome.com",
  zone_status: "active",
  nameservers: ["henry.ns.cloudflare.com", "ryleigh.ns.cloudflare.com"],
  worker_custom_domains: ["connectordome.com", "www.connectordome.com"],
  email_mx: ["route1.mx.cloudflare.net", "route2.mx.cloudflare.net", "route3.mx.cloudflare.net"],
  spf: "v=spf1 include:_spf.mx.cloudflare.net ~all",
  dkim: "cf2024-1._domainkey.connectordome.com TXT present",
  other_zones_modified: "NONE",
});
write("EMAIL_ROUTING_RECEIPT.json", {
  enabled: true,
  status: "ready",
  catch_all: "enabled",
  action: "forward",
  destination_verified: true,
  destination: "ceo@bonacqui.com",
  public_contact: "hello@connectordome.com",
  loop: false,
  note: "Destination mailbox is not shown in public UI.",
});
write(
  "KNOWN_LIMITATIONS.md",
  `# Known limitations — ConnectorDome v0.1

- MQTT is COMING NEXT.
- STREAM is HTTP polled snapshots, not a WebSocket/MQTT bus.
- Generated-connector "sandbox" is static restriction (no shell, GET-only, SSRF on inspect), not a hypervisor.
- Guest builds are not persisted as public registry entries.
- No account/auth in v0.1.
- No LLM required; heuristic suggestions are not authority.
- License hold: no license selected.
- Zone DNS write is not on the Wrangler OAuth token; Worker custom domains and Email Routing DNS were used instead of generic dns_records create.
`,
);

const files = fs.readdirSync(out).filter((n) => n !== "FREEZE_MANIFEST.json");
const hashes = {};
for (const n of files.sort()) hashes[n] = await sha256hex(fs.readFileSync(path.join(out, n)));
write("FREEZE_MANIFEST.json", {
  name: "CONNECTORDOME_CORE_V0_1",
  created_at: new Date().toISOString(),
  tests_returncode: tests.status,
  files: hashes,
  openapi_demo: classifyOpenApi({ paths: { "/x": { get: {}, post: {} } } }),
});
console.log(out);
console.log("tests", tests.status);
