import { ACTION_AUTHORITY, PROVENANCE_MODES, provenanceForSourceKind } from "./asf.js";

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

  const expected = provenanceForSourceKind(manifest.source_kind);
  add(
    "provenance",
    manifest.provenance_mode === expected && PROVENANCE_MODES.includes(manifest.provenance_mode),
    `${manifest.provenance_mode} matches ${manifest.source_kind}`,
  );

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
  const secretHit = /("?(api_key|token|password|secret)"?\s*:\s*"(?!secret_ref)[^"]{8,}")/i.test(blob);
  const forbiddenHit = FORBIDDEN_IN_PACKAGE.find((s) => blob.includes(s));
  add("no embedded secrets", !secretHit && !blob.includes("secret_value"), "secret_ref only");
  add("no execution surface", !forbiddenHit && !mutating, forbiddenHit ? `hit ${forbiddenHit}` : "no shell/POST/actuate");

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
