import { assertPublicHttpsUrl, assertRedirectSafe, assertResolvedAddressesPublic } from "./ssrf.js";
import { utcnow } from "./asf.js";

export function flattenFields(value, prefix = "", out = [], depth = 0) {
  if (depth > 8) return out;
  if (value === null || value === undefined) {
    out.push({ path: prefix || "(root)", value: null, type: "null" });
    return out;
  }
  const t = Array.isArray(value) ? "array" : typeof value;
  if (t === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (!prefix) {
      for (const k of keys) flattenFields(value[k], escapePathSegment(k), out, depth + 1);
    } else {
      for (const k of keys) flattenFields(value[k], `${prefix}.${escapePathSegment(k)}`, out, depth + 1);
    }
    return out;
  }
  if (t === "array") {
    out.push({ path: prefix || "(root)", value: `[${value.length} items]`, type: "array" });
    if (value.length && depth < 4) flattenFields(value[0], `${prefix}[0]`, out, depth + 1);
    return out;
  }
  out.push({ path: prefix || "(root)", value, type: t });
  return out;
}

export async function inspectUrl(rawUrl, { fetchImpl = fetch, fixtureLoader = null, resolveHost = null } = {}) {
  const received_at = utcnow();
  if (typeof rawUrl === "string" && (rawUrl.startsWith("/fixtures/") || rawUrl.startsWith("fixtures/"))) {
    if (!fixtureLoader) throw new Error("fixtureLoader required for local fixtures");
    const body = await fixtureLoader(rawUrl.replace(/^\//, ""));
    let json;
    try { json = JSON.parse(body); }
    catch {
      return { source: rawUrl, source_reference: "embedded:fixture.json", content_type: "application/json", reachability: "MALFORMED_SOURCE", retrieval_time_ms: 0, provenance_class: "TEST_FIXTURE", error: "MALFORMED_SOURCE: fixture is not valid JSON", body: null, fields: [], connector_received_at: received_at, method: "GET" };
    }
    return {
      source: rawUrl,
      source_reference: "embedded:fixture.json",
      content_type: "application/json",
      reachability: "OK",
      retrieval_time_ms: 0,
      provenance_class: "TEST_FIXTURE",
      note: "Same-origin demonstration fixture; generated packages embed a copy.",
      body: json,
      fields: flattenFields(json),
      connector_received_at: received_at,
      method: "GET",
    };
  }

  const url = assertPublicHttpsUrl(rawUrl);
  const t0 = Date.now();
  let current = url;
  let res = null;
  for (let hop = 0; hop < 4; hop++) {
    if (resolveHost) assertResolvedAddressesPublic(await resolveHost(current.hostname));
    res = await fetchImpl(current.href, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json, application/yaml, text/plain, */*;q=0.1" },
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      current = assertRedirectSafe(current, loc);
      continue;
    }
    break;
  }
  const retrieval_time_ms = Date.now() - t0;
  if (!res || !res.ok) {
    return {
      source: url.hostname,
      content_type: res?.headers.get("content-type") || null,
      reachability: "UNAVAILABLE",
      retrieval_time_ms,
      provenance_class: "REMOTE_FEED",
      error: `source UNAVAILABLE (${res ? res.status : "no response"})`,
      body: null,
      fields: [],
      connector_received_at: received_at,
      method: "GET",
    };
  }
  const content_type = res.headers.get("content-type") || "application/octet-stream";
  const text = await res.text();
  let body = text;
  let fields = [];
  if (/json/i.test(content_type) || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      body = JSON.parse(text);
      fields = flattenFields(body);
    } catch {
      return {
        source: current.hostname,
        url: current.href,
        content_type,
        reachability: "MALFORMED_SOURCE",
        retrieval_time_ms,
        provenance_class: "REMOTE_FEED",
        error: "MALFORMED_SOURCE: response advertised or resembled JSON but could not be parsed",
        body: null,
        fields: [],
        connector_received_at: received_at,
        method: "GET",
      };
    }
  } else {
    fields = [{ path: "(raw)", value: text.slice(0, 500), type: "string" }];
  }
  return {
    source: current.hostname,
    url: current.href,
    content_type,
    reachability: "OK",
    retrieval_time_ms,
    provenance_class: "REMOTE_FEED",
    body,
    fields,
    connector_received_at: received_at,
    method: "GET",
  };
}

export function getByPath(obj, path) {
  if (!path) return undefined;
  const parts = parseFieldPath(path);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function escapePathSegment(segment) {
  return String(segment).replace(/\\/g, "\\\\").replace(/\./g, "\\.");
}

export function parseFieldPath(path) {
  if (String(path).startsWith("/")) {
    return String(path).slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  }
  const normalized = String(path).replace(/\[(\d+)\]/g, ".$1");
  const parts = [];
  let current = "";
  let escaped = false;
  for (const char of normalized) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === ".") { if (current) parts.push(current); current = ""; continue; }
    current += char;
  }
  if (escaped) current += "\\";
  if (current) parts.push(current);
  return parts;
}
