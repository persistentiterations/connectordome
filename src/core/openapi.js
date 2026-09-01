const MUTATING = new Set(["post", "put", "patch", "delete"]);
const READ = new Set(["get", "head"]);

export function classifyOpenApi(spec) {
  if (!spec || typeof spec !== "object") throw new Error("invalid OpenAPI document");
  const paths = spec.paths || {};
  const included = [];
  const excluded = [];
  for (const [path, ops] of Object.entries(paths)) {
    if (!ops || typeof ops !== "object") continue;
    for (const [method, op] of Object.entries(ops)) {
      const m = method.toLowerCase();
      if (m.startsWith("x-") || m === "parameters" || m === "summary" || m === "description" || m === "servers") {
        continue;
      }
      const item = {
        method: m.toUpperCase(),
        path,
        operationId: op?.operationId || null,
        summary: op?.summary || "",
      };
      if (READ.has(m)) included.push(item);
      else if (MUTATING.has(m)) excluded.push({ ...item, reason: "EXCLUDED — MUTATING OPERATION" });
      else excluded.push({ ...item, reason: "EXCLUDED — NON-GET METHOD" });
    }
  }
  return {
    title: spec.info?.title || "OpenAPI",
    version: spec.info?.version || null,
    included,
    excluded,
    mutating_operations_exposed: false,
  };
}
