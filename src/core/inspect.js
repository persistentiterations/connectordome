import { assertPublicHttpsUrl, assertRedirectSafe } from "./ssrf.js";
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
      for (const k of keys) flattenFields(value[k], k, out, depth + 1);
    } else {
      for (const k of keys) flattenFields(value[k], `${prefix}.${k}`, out, depth + 1);
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

export async function inspectUrl(rawUrl, { fetchImpl = fetch, fixtureLoader = null } = {}) {
  const received_at = utcnow();
  if (typeof rawUrl === "string" && (rawUrl.startsWith("/fixtures/") || rawUrl.startsWith("fixtures/"))) {
    if (!fixtureLoader) throw new Error("fixtureLoader required for local fixtures");
    const body = await fixtureLoader(rawUrl.replace(/^\//, ""));
    const json = JSON.parse(body);
    return {
      source: rawUrl,
      content_type: "application/json",
      reachability: "OK",
      retrieval_time_ms: 0,
      provenance_class: "REMOTE_FEED",
      note: "Same-origin fixture. Public demo data, not LIVE_LOCAL.",
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
      fields = [{ path: "(raw)", value: text.slice(0, 500), type: "string" }];
    }
  } else {
    fields = [{ path: "(raw)", value: text.slice(0, 500), type: "string" }];
  }
  return {
    source: url.hostname,
    url: url.href,
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
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}
