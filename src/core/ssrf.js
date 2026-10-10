/** Block SSRF toward localhost, LAN, metadata, and unexpected private redirects. */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

export function isPrivateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const oct = m.slice(1).map((n) => Number(n));
  if (oct.some((n) => n > 255)) return false;
  const [a, b] = oct;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

export function hostnameBlocked(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.endsWith(".lan") || host.endsWith(".home")) return true;
  if (isPrivateIPv4(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

export function assertPublicHttpsUrl(raw, { allowHttp = false } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid URL");
  }
  if (url.protocol === "http:" && allowHttp) {
    // still block private
  } else if (url.protocol !== "https:") {
    throw new Error("only https remote URLs are allowed");
  }
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  if (hostnameBlocked(url.hostname)) throw new Error("SSRF_BLOCKED: private or metadata destination");
  return url;
}

export function assertRedirectSafe(fromUrl, locationHeader) {
  if (!locationHeader) throw new Error("empty redirect");
  const next = new URL(locationHeader, fromUrl);
  assertPublicHttpsUrl(next.href);
  if (next.hostname !== fromUrl.hostname && hostnameBlocked(next.hostname)) {
    throw new Error("SSRF_BLOCKED: redirect to private destination");
  }
  return next;
}

export function assertResolvedAddressesPublic(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error("DNS_UNVERIFIED: resolver returned no addresses");
  for (const address of addresses) {
    if (hostnameBlocked(address)) throw new Error("SSRF_BLOCKED: DNS resolved to private or metadata destination");
  }
  return true;
}
