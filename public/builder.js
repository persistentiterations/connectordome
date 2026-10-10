const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let kind = "web_api";
let inspection = null;
let lastBuild = null;

document.querySelectorAll(".kind").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    kind = btn.dataset.kind;
    document.querySelectorAll(".kind").forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    $("url-box").hidden = kind === "simulator" || kind === "text_claim";
    $("oa-box").hidden = kind !== "openapi";
  });
});

$("demo").onclick = () => {
  $("url").value = "/fixtures/demo-station.json";
  $("field").value = "temperature";
  $("capability").value = "weather.air.temperature";
  $("units").value = "C";
  $("timef").value = "observed_at";
  $("name").value = "demo-station";
  kind = "web_api";
};

$("suggest").onclick = async () => {
  const r = await fetch("/api/suggest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: $("desc").value }),
  });
  const j = await r.json();
  if (!r.ok || j.status === "HOLD") {
    inspection = null;
    $("inspect-out").textContent = j.error || "Inspection failed";
    $("map-box").hidden = true;
    return;
  }
  $("suggest-out").hidden = false;
  $("suggest-out").textContent = "SUGGESTION ONLY — not authority\n" + JSON.stringify(j, null, 2);
};

$("classify").onclick = async () => {
  let spec;
  try { spec = JSON.parse($("oaspec").value); } catch { $("oa-out").hidden = false; $("oa-out").textContent = "invalid JSON"; return; }
  const r = await fetch("/api/openapi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) });
  const j = await r.json();
  $("oa-out").hidden = false;
  $("oa-out").textContent = JSON.stringify(j, null, 2);
};

$("inspect").onclick = async () => {
  $("inspect-out").hidden = false;
  $("inspect-out").innerHTML = "<p class='status'>inspecting…</p>";
  if (kind === "simulator" || kind === "text_claim") {
    inspection = null;
    $("inspect-out").innerHTML = "<p>No URL inspect for this kind. Continue to map.</p>";
    $("map-box").hidden = false;
    if (kind === "simulator") {
      $("field").value = "charge_percent";
      $("capability").value = "battery.charge_percent";
      $("units").value = "percent";
    } else {
      $("field").value = "claimed.charge_percent";
      $("capability").value = "text.claim.numeric";
      $("units").value = "percent";
    }
    return;
  }
  const r = await fetch("/api/inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: $("url").value.trim() }),
  });
  const j = await r.json();
  inspection = j;
  const fields = (j.fields || [])
    .map(
      (f) =>
        `<button type="button" data-path="${escapeHtml(f.path)}">${escapeHtml(f.path)}    ${escapeHtml(JSON.stringify(f.value))}</button>`,
    )
    .join("");
  $("inspect-out").innerHTML = `
    <h2>Inspection</h2>
    <table>
      <tr><th>SOURCE</th><td>${escapeHtml(j.source)}</td></tr>
      <tr><th>CONTENT TYPE</th><td>${escapeHtml(j.content_type)}</td></tr>
      <tr><th>REACHABILITY</th><td>${escapeHtml(j.reachability || j.error)}</td></tr>
      <tr><th>RETRIEVAL TIME</th><td>${escapeHtml(j.retrieval_time_ms)} ms</td></tr>
      <tr><th>PROVENANCE CLASS</th><td>${escapeHtml(j.provenance_class)}</td></tr>
    </table>
    <h2>Fields</h2>
    <div class="fields">${fields || "<p>none</p>"}</div>`;
  $("inspect-out").querySelectorAll("button[data-path]").forEach((b) => {
    b.onclick = () => {
      $("field").value = b.dataset.path;
      $("map-box").hidden = false;
    };
  });
  if (j.reachability === "OK") $("map-box").hidden = false;
};

function mapping() {
  return {
    field: $("field").value.trim(),
    capability: $("capability").value.trim(),
    units: $("units").value.trim() || null,
    data_type: $("dtype").value,
    time_field: $("timef").value.trim() || null,
    poll_interval_s: kind === "stream" ? 1 : null,
    license: $("license") ? $("license").value : "UNSPECIFIED",
  };
}

$("preview").onclick = async () => {
  const r = await fetch("/api/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      url: $("url").value.trim(),
      inspection,
      mapping: mapping(),
      name: $("name").value.trim() || "connector",
      statement: $("desc").value,
    }),
  });
  const j = await r.json();
  $("preview-box").hidden = false;
  if (!r.ok || j.status === "HOLD" || !j.asf) {
    $("raw").textContent = JSON.stringify(j.raw ?? null, null, 2);
    $("asf").textContent = j.error || "HOLD — preview did not produce a valid observation event";
    return;
  }
  $("raw").textContent = JSON.stringify(j.raw, null, 2);
  if (j.schema_drift) {
    $("asf").textContent = "SCHEMA_DRIFT\nMapped field missing. Value not fabricated.";
  } else {
    const e = j.asf;
    $("asf").textContent = [
      `source: ${e.source_id}`,
      `provenance: ${e.provenance_mode}`,
      `capability: ${e.capability_id}`,
      `value: ${JSON.stringify(e.value)}`,
      `unit: ${e.units}`,
      `observed_at_source: ${e.source_observed_at}`,
      `received_at: ${e.connector_received_at}`,
      `ASF_ingested_at: ${e.asf_ingested_at}`,
      `action_authority: ${e.action_authority}`,
    ].join("\n");
  }
};

$("build").onclick = async () => {
  lastBuild = null;
  $("download").disabled = true;
  $("result-box").hidden = false;
  $("checks").textContent = "building…";
  const r = await fetch("/api/build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      url: $("url").value.trim(),
      inspection,
      mapping: mapping(),
      name: $("name").value.trim() || "connector",
      description: $("desc").value,
    }),
  });
  const j = await r.json();
  $("checks").textContent = j.check_text || JSON.stringify(j, null, 2);
  const ok = j.status === "CONFORMANCE_PASS";
  $("verdict").className = ok ? "pass" : "hold";
  $("verdict").textContent = ok ? "CONFORMANCE PASS" : "HOLD";
  if (ok && j.artifact_issued && j.zip_base64) lastBuild = j;
  $("download").disabled = !lastBuild;
};

$("download").onclick = () => {
  if (lastBuild?.status !== "CONFORMANCE_PASS" || !lastBuild?.artifact_issued || !lastBuild?.zip_base64) return;
  const bin = Uint8Array.from(atob(lastBuild.zip_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bin], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = lastBuild.filename || "connector.zip";
  a.click();
};
