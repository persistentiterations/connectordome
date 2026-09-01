const $ = (id) => document.getElementById(id);
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
        `<button type="button" data-path="${f.path}">${f.path}    ${JSON.stringify(f.value)}</button>`,
    )
    .join("");
  $("inspect-out").innerHTML = `
    <h2>Inspection</h2>
    <table>
      <tr><th>SOURCE</th><td>${j.source || ""}</td></tr>
      <tr><th>CONTENT TYPE</th><td>${j.content_type || ""}</td></tr>
      <tr><th>REACHABILITY</th><td>${j.reachability || j.error || ""}</td></tr>
      <tr><th>RETRIEVAL TIME</th><td>${j.retrieval_time_ms ?? ""} ms</td></tr>
      <tr><th>PROVENANCE CLASS</th><td>${j.provenance_class || ""}</td></tr>
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
      statement: $("desc").value,
    }),
  });
  const j = await r.json();
  $("preview-box").hidden = false;
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
  lastBuild = j;
  $("checks").textContent = j.check_text || JSON.stringify(j, null, 2);
  const ok = j.status === "CONFORMANCE_PASS";
  $("verdict").className = ok ? "pass" : "hold";
  $("verdict").textContent = ok ? "CONFORMANCE PASS" : "HOLD";
  $("download").disabled = !ok && false;
};

$("download").onclick = () => {
  if (!lastBuild?.zip_base64) return;
  const bin = Uint8Array.from(atob(lastBuild.zip_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bin], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = lastBuild.filename || "connector.zip";
  a.click();
};
