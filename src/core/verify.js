import { ACTION_AUTHORITY, PROVENANCE_MODES, provenanceForSourceKind } from "./asf.js";
import { DATA_TYPES } from "./observation.js";

const FORBIDDEN_IN_PACKAGE = [
  "child_process",
  "subprocess",
  "execSync",
  "spawnSync",
  "adb ",
  "POST ",
  "method: \"POST\"",
  "method: 'POST'",
  "secret_value",
  "api_key\":",
  "BEGIN PRIVATE KEY",
];

export function verifyConnector({ manifest, files, preview }) {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, result: pass ? "PASS" : "HOLD", detail });

  add("manifest", !!(manifest && manifest.name && manifest.source_kind && manifest.capabilities?.length), "name, source_kind, capabilities");

  const methods = (manifest.http_methods || ["GET"]).map((m) => m.toUpperCase());
  const mutating = methods.some((m) => ["POST", "PUT", "PATCH", "DELETE"].includes(m));
  add("read-only", !mutating && (manifest.actuation || "NONE") === "NONE", "GET/HEAD only; actuation NONE");

  const expected = provenanceForSourceKind(manifest.source_observed || manifest.source_kind);
  add(
    "provenance",
    manifest.provenance_mode === expected && PROVENANCE_MODES.includes(manifest.provenance_mode) && manifest.provenance_observed === expected,
    `${manifest.provenance_mode} checked against observed acquisition ${manifest.provenance_observed}`,
  );

  add("capability identifiers", manifest.capabilities.every((c) => typeof c.capability_id === "string" && c.capability_id.trim()), "non-empty capability_id");
  add("data types", manifest.capabilities.every((c) => DATA_TYPES.includes(c.data_type)), "declared types use the supported strict grammar");

  add(
    "units",
    manifest.capabilities.every((c) => Object.prototype.hasOwnProperty.call(c, "units")),
    "each capability declares units (may be null)",
  );

  const times = ["source_observed_at", "connector_received_at", "asf_ingested_at"];
  const previewHasTimes =
    preview?.asf && times.every((k) => Object.prototype.hasOwnProperty.call(preview.asf, k));
  add("timestamps", !!previewHasTimes, "source/received/ingested remain separate");

  add(
    "source unavailable handling",
    manifest.unavailable_behavior === "UNAVAILABLE" && manifest.no_fabrication === true,
    "missing source is UNAVAILABLE, not invented",
  );

  const blob = Object.entries(files || {})
    .map(([n, c]) => `${n}\n${c}`)
    .join("\n");
  const secretHit = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|private[_-]?key)\s*[=:]\s*(?:["'][^"']{6,}["']|(?:bearer\s+)?[a-z0-9_./+=-]{8,})/i.test(blob);
  const forbiddenHit = FORBIDDEN_IN_PACKAGE.find((s) => blob.includes(s));
  add("no embedded secrets", !secretHit && !blob.includes("secret_value"), "secret_ref only");
  add("no execution surface", !forbiddenHit && !mutating, forbiddenHit ? `hit ${forbiddenHit}` : "no shell/POST/actuate");

  const adapter = files?.["adapter.mjs"] || "";
  const runtime = files?.["runtime.mjs"] || "";
  const packageJson = files?.["package.json"] || "";
  add("runtime contract", ["event_id", "source_id", "device_id", "source_observed_at", "connector_received_at", "asf_ingested_at", "source_health"].every((field) => runtime.includes(field)), "generated runtime emits the ASF identity and time contract");
  add("test discovery", !!files?.["tests/adapter.test.mjs"] && packageJson.includes("tests/*.test.mjs"), "packaged tests are discoverable and non-empty");
  add("portable source", manifest.source_kind !== "fixture" || (!!files?.["fixture.json"] && manifest.source_reference === "embedded:fixture.json"), "fixtures are embedded; remote URLs are explicit");
  add("preview valid", !!preview?.asf && preview.schema_drift !== true, "the candidate preview is a valid observation event");

  if (manifest.secret_ref && manifest.secret_value) {
    checks.find((c) => c.id === "no embedded secrets").result = "HOLD";
  }

  if (preview?.asf?.action_authority && preview.asf.action_authority !== ACTION_AUTHORITY) {
    add("action_authority", false, preview.asf.action_authority);
  } else {
    add("action_authority", true, "NONE");
  }

  const hold = checks.filter((c) => c.result === "HOLD");
  return {
    status: hold.length ? "HOLD" : "CONFORMANCE_PASS",
    checks,
    mutating_operations_exposed: mutating ? methods : [],
    live_actuation: "NONE",
  };
}

export function formatCheckLines(report) {
  return report.checks.map((c) => `[${c.result}] ${c.id}${c.detail ? " — " + c.detail : ""}`).join("\n");
}
