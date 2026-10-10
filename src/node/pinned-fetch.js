import dns from "node:dns/promises";
import https from "node:https";
import { assertResolvedAddressesPublic } from "../core/ssrf.js";

export async function resolvePinnedTarget(hostname, lookupImpl = dns.lookup) {
  const records = await lookupImpl(hostname, { all: true, verbatim: true, family: 4 });
  if (!Array.isArray(records) || records.length === 0) throw new Error("UNAVAILABLE: DNS returned no addresses");
  assertResolvedAddressesPublic(records.map((record) => record.address));
  return { address: records[0].address, family: records[0].family };
}

export function createPinnedHttpsFetch({ lookupImpl = dns.lookup, requestImpl = https.request } = {}) {
  return async function fetchPinned(rawUrl, options = {}) {
    const url = new URL(rawUrl);
    const target = await resolvePinnedTarget(url.hostname, lookupImpl);
    return new Promise((resolve, reject) => {
      const request = requestImpl(url, {
        method: options.method || "GET",
        headers: options.headers,
        lookup(_hostname, lookupOptions, callback) {
          if (lookupOptions?.all) callback(null, [{ address: target.address, family: target.family }]);
          else callback(null, target.address, target.family);
        },
      }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
      });
      request.setTimeout?.(15000, () => request.destroy(new Error("UNAVAILABLE: request timeout")));
      request.on("error", reject);
      request.end();
    });
  };
}

export const pinnedHttpsFetch = createPinnedHttpsFetch();
