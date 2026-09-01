/** Heuristic suggestions. NOT authority. Builder works without an LLM. */

const HINTS = [
  { re: /temp|air.?temp|celsius|fahrenheit/i, capability: "weather.air.temperature", units: "C", modality: "thermal" },
  { re: /humid/i, capability: "weather.air.humidity", units: "percent", modality: "environment" },
  { re: /pressure|hpa|mbar/i, capability: "weather.air.pressure", units: "hPa", modality: "environment" },
  { re: /wind/i, capability: "weather.wind.speed", units: "m/s", modality: "environment" },
  { re: /volt/i, capability: "electrical.voltage", units: "V", modality: "power" },
  { re: /current|amper/i, capability: "electrical.current", units: "A", modality: "power" },
  { re: /battery|charge/i, capability: "battery.charge_percent", units: "percent", modality: "power" },
  { re: /vibrat/i, capability: "machine.vibration", units: "g", modality: "motion" },
  { re: /bearing/i, capability: "machine.bearing.temperature", units: "C", modality: "thermal" },
  { re: /uptime/i, capability: "system.uptime", units: "s", modality: "time" },
];

export function suggestFromDescription(text) {
  const t = String(text || "");
  const hits = [];
  for (const h of HINTS) {
    if (h.re.test(t)) hits.push({ ...h, re: undefined, note: "heuristic suggestion; not authority" });
  }
  return {
    authority: false,
    label: "SUGGESTION ONLY — not authority",
    source_class_guess: /simulat/i.test(t) ? "simulator" : /claim|said|reported as text/i.test(t) ? "text_claim" : "web_api",
    mappings: hits,
  };
}

export function suggestForField(path) {
  for (const h of HINTS) {
    if (h.re.test(path)) return { capability: h.capability, units: h.units, modality: h.modality, authority: false };
  }
  return {
    capability: path.replace(/\[(\d+)\]/g, "").split(".").filter(Boolean).join(".") || "observation.value",
    units: null,
    modality: "observation",
    authority: false,
  };
}

export function looksLikeTimeField(path) {
  return /(observed_at|published_at|timestamp|time$|datetime|_at$)/i.test(path);
}
