import { inspectUrl } from "./core/inspect.js";
import { classifyOpenApi } from "./core/openapi.js";
import { previewEvent, simulationBody, textClaimBody } from "./core/builder.js";
import { suggestFromDescription } from "./core/suggest.js";
import { buildPackage, manifestFromBuild } from "./core/package.js";
import { getConnector, searchRegistry } from "./core/registry.js";
import { assertPublicHttpsUrl } from "./core/ssrf.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function readAssetText(env, path) {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, "https://connectordome.com");
  const res = await env.ASSETS.fetch(new Request(url.href));
  if (!res.ok) throw new Error("fixture UNAVAILABLE");
  return await res.text();
}

function fixtureLoader(env) {
  return async (rel) => readAssetText(env, rel.startsWith("/") ? rel : `/${rel}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.connectordome.com") {
      url.hostname = "connectordome.com";
      return Response.redirect(url.href, 301);
    }

    if (url.pathname === "/health") {
      return json({ service: "connectordome", version: "0.1.0", actuation: "NONE" });
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: String(err.message || err), status: "HOLD" }, 400);
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("not found", { status: 404 });
  },
};

async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/registry") {
    const items = searchRegistry(url.searchParams.get("q") || "", url.searchParams.get("category") || "");
    return json({ connectors: items, note: "Demonstration listings only. Not a manufactured ecosystem." });
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/connectors/")) {
    const id = url.pathname.slice("/api/connectors/".length);
    const c = getConnector(id);
    if (!c) return json({ error: "unknown connector" }, 404);
    return json(c);
  }

  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));

  if (url.pathname === "/api/inspect") {
    const target = body.url;
    if (!target) return json({ error: "url required" }, 400);
    if (typeof target === "string" && !target.startsWith("/fixtures/") && !target.startsWith("fixtures/")) {
      assertPublicHttpsUrl(target);
    }
    const result = await inspectUrl(target, { fixtureLoader: fixtureLoader(env) });
    return json(result, result.reachability === "OK" ? 200 : 409);
  }

  if (url.pathname === "/api/suggest") {
    return json(suggestFromDescription(body.description || ""));
  }

  if (url.pathname === "/api/openapi") {
    return json(classifyOpenApi(body.spec || body));
  }

  if (url.pathname === "/api/preview" || url.pathname === "/api/build") {
    const kind = body.kind;
    if (!kind) return json({ error: "kind required" }, 400);
    let inspection = body.inspection;
    if (!inspection) {
      if (kind === "simulator") {
        const b = simulationBody(body.seed);
        inspection = {
          source: "simulator",
          body: b,
          fields: Object.entries(b).map(([path, value]) => ({ path, value, type: typeof value })),
          reachability: "OK",
          provenance_class: "SIMULATION",
          connector_received_at: new Date().toISOString(),
        };
      } else if (kind === "text_claim") {
        const b = textClaimBody(body.statement || "battery = 73%", body.value ?? { charge_percent: 73 });
        inspection = {
          source: "operator",
          body: b,
          fields: [
            { path: "statement", value: b.statement, type: "string" },
            { path: "claimed", value: b.claimed, type: typeof b.claimed },
          ],
          reachability: "OK",
          provenance_class: "TEXT_CLAIM",
          connector_received_at: new Date().toISOString(),
        };
      } else if (body.url) {
        inspection = await inspectUrl(body.url, { fixtureLoader: fixtureLoader(env) });
        if (inspection.reachability !== "OK") return json({ error: inspection.error || "UNAVAILABLE", inspection }, 409);
      } else {
        return json({ error: "url or inspection required" }, 400);
      }
    }
    const mapping = body.mapping || {};
    const preview = await previewEvent({ inspection, mapping, kind });
    if (url.pathname === "/api/preview") return json(preview);

    const manifest = manifestFromBuild({
      kind,
      name: body.name,
      inspection,
      mapping,
      description: body.description || "",
    });
    const pkg = await buildPackage({ manifest, preview, mapping, inspection });
    const zip_b64 = btoa(String.fromCharCode(...pkg.zip));
    return json({
      status: pkg.report.status,
      checks: pkg.report.checks,
      check_text: pkg.check_text,
      manifest,
      preview,
      package_hash: pkg.package_hash,
      files: pkg.files,
      zip_base64: zip_b64,
      filename: `${pkg.name}-0.1.0.zip`,
      mutating_operations_exposed: pkg.report.mutating_operations_exposed,
      live_actuation: "NONE",
    });
  }

  return json({ error: "unknown api" }, 404);
}
