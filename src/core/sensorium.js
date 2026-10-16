/** Open Sensorium source-family registry v0.3. SPDX-License-Identifier: Apache-2.0 */

export const SENSORIUM_SCHEMA = "connectordome.source-family/v0.3";

export const SOURCE_FAMILIES = Object.freeze([
  {
    schema: SENSORIUM_SCHEMA,
    id: "us-nws-observations",
    name: "National Weather Service station observations",
    category: "weather-atmosphere",
    publisher: { name: "U.S. National Weather Service", url: "https://www.weather.gov/" },
    documentation_url: "https://www.weather.gov/documentation/services-web-api",
    api_base_url: "https://api.weather.gov/",
    example_endpoint: "https://api.weather.gov/stations/KJFK/observations/latest",
    access: { method: "GET", authentication: "NONE", format: "GeoJSON / JSON-LD", account_required: false },
    identifiers: { family: "NWS station identifier", example: "KJFK" },
    observations: ["air temperature", "dew point", "wind", "pressure", "visibility", "precipitation where reported"],
    units: "QuantitativeValue objects declare unitCode; null values are possible",
    geographic_coverage: "United States NWS observation network",
    temporal_coverage: "Current and recent station observations; varies by station",
    timestamps: { convention: "ISO 8601 with timezone", clock_uncertainty: "UNKNOWN", publication_time: "Not uniformly exposed as a separate field" },
    quality: { statement: "Publisher-provided fields and nullability preserved", calibration: "UNKNOWN at family level" },
    permissions: { license_status: "OPEN_DATA", permitted_uses: ["research", "inference", "redistribution"], ai_training: "NOT_SEPARATELY_RESTRICTED_IN_API_DOCUMENTATION", evidence_url: "https://www.weather.gov/documentation/services-web-api", attribution: "Publisher attribution recommended" },
    rate_limits: { status: "PRESENT_NOT_PUBLIC", note: "NWS documents reasonable non-public limits; clients must cache and avoid abuse." },
    reference_compatibility: { spatial: "GeoJSON coordinates; station metadata", temporal: "UTC-compatible timestamps", exact_uncertainty: "UNKNOWN" },
    operational_status: "LIVE_VERIFIED",
    verification: { verified_at: "2026-10-16T13:00:00Z", http_status: 200, method: "independent HTTPS GET", endpoint_scope: "example only", receipt: "cd-source-check-2026-10-16-nws" },
    adapter_status: "SPECIFIED_NOT_IMPLEMENTED",
    action_authority: "NONE"
  },
  {
    schema: SENSORIUM_SCHEMA,
    id: "usgs-water-data-continuous",
    name: "USGS Water Data continuous observations",
    category: "rivers-groundwater-water-quality",
    publisher: { name: "U.S. Geological Survey", url: "https://www.usgs.gov/" },
    documentation_url: "https://api.waterdata.usgs.gov/docs/ogcapi/",
    api_base_url: "https://api.waterdata.usgs.gov/ogcapi/",
    example_endpoint: "https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?monitoring_location_id=USGS-01646500&parameter_code=00060&f=json&limit=1",
    access: { method: "GET", authentication: "OPTIONAL_API_KEY_FOR_HIGHER_LIMITS", format: "OGC API Features / GeoJSON", account_required: false },
    identifiers: { family: "USGS monitoring location and parameter codes", example: "USGS-01646500 / 00060" },
    observations: ["streamflow", "gage height", "water temperature", "other site-dependent continuous parameters"],
    units: "Declared per time series and parameter",
    geographic_coverage: "United States monitoring locations",
    temporal_coverage: "Varies by collection, site, and parameter",
    timestamps: { convention: "API fields are machine-readable; validate each collection contract", clock_uncertainty: "UNKNOWN", publication_time: "Collection-dependent" },
    quality: { statement: "Recent values may be provisional; preserve publisher qualifiers", calibration: "Site and series dependent" },
    permissions: { license_status: "US_GOVERNMENT_PUBLIC_DOMAIN", permitted_uses: ["research", "inference", "redistribution"], ai_training: "NOT_SEPARATELY_RESTRICTED_IN_API_DOCUMENTATION", evidence_url: "https://api.waterdata.usgs.gov/ogcapi/v0/?f=html", attribution: "USGS requests citation in publications" },
    rate_limits: { status: "DOCUMENTED", note: "Anonymous access is bounded; an API key provides higher limits. Query the minimum data needed." },
    reference_compatibility: { spatial: "OGC feature geometry and monitoring-location metadata", temporal: "Collection-dependent observation time", exact_uncertainty: "UNKNOWN" },
    operational_status: "LIVE_VERIFIED",
    verification: { verified_at: "2026-10-16T13:00:00Z", http_status: 200, method: "independent HTTPS GET", endpoint_scope: "example only", receipt: "cd-source-check-2026-10-16-usgs" },
    adapter_status: "SPECIFIED_NOT_IMPLEMENTED",
    action_authority: "NONE"
  },
  {
    schema: SENSORIUM_SCHEMA,
    id: "noaa-coops-water-levels",
    name: "NOAA CO-OPS coastal water-level observations",
    category: "oceans-buoys-tides-waves",
    publisher: { name: "NOAA Center for Operational Oceanographic Products and Services", url: "https://tidesandcurrents.noaa.gov/" },
    documentation_url: "https://www.tidesandcurrents.noaa.gov/web_services_info.html",
    api_base_url: "https://api.tidesandcurrents.noaa.gov/api/prod/",
    example_endpoint: "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=8518750&product=water_level&datum=MLLW&time_zone=gmt&units=metric&application=ConnectorDome&format=json",
    access: { method: "GET", authentication: "NONE", format: "JSON", account_required: false },
    identifiers: { family: "CO-OPS seven-digit station identifier", example: "8518750" },
    observations: ["water level", "water temperature", "air temperature", "barometric pressure", "winds where available"],
    units: "Request parameter selects metric or English; datum is mandatory for water level",
    geographic_coverage: "Participating U.S. coastal and Great Lakes stations; product availability varies",
    temporal_coverage: "Current and historical ranges vary by product and station",
    timestamps: { convention: "Requested time_zone controls output; demonstration requests GMT", clock_uncertainty: "UNKNOWN", publication_time: "Not separately declared in the sample response" },
    quality: { statement: "Water-level q flag distinguishes preliminary (p) and verified (v); preserve flags", calibration: "Station/product dependent" },
    permissions: { license_status: "UNKNOWN", permitted_uses: ["research", "inference"], ai_training: "UNKNOWN", evidence_url: "https://www.tidesandcurrents.noaa.gov/web_services_info.html", attribution: "UNKNOWN; verify for each downstream use" },
    rate_limits: { status: "DOCUMENTED_BY_INTERVAL", note: "Request-size limits vary by sampling interval; use bounded queries." },
    reference_compatibility: { spatial: "Station latitude/longitude", temporal: "GMT requested explicitly", vertical: "Declared tidal datum required", exact_uncertainty: "Sigma and quality flags may be present" },
    operational_status: "LIVE_VERIFIED",
    verification: { verified_at: "2026-10-16T13:00:00Z", http_status: 200, method: "independent HTTPS GET", endpoint_scope: "example only", receipt: "cd-source-check-2026-10-16-coops" },
    adapter_status: "SPECIFIED_NOT_IMPLEMENTED",
    action_authority: "NONE"
  }
]);

export function validateSourceFamily(record) {
  const errors = [];
  if (record?.schema !== SENSORIUM_SCHEMA) errors.push("unsupported schema");
  for (const field of ["id", "name", "category", "documentation_url", "api_base_url", "operational_status", "adapter_status"]) {
    if (!record?.[field]) errors.push(`${field} is required`);
  }
  if (record?.access?.method !== "GET") errors.push("only GET source families are accepted");
  if (record?.action_authority !== "NONE") errors.push("source records cannot grant action authority");
  if (!record?.permissions?.license_status || !record?.permissions?.ai_training) errors.push("permission unknowns must be explicit");
  if (!record?.verification?.verified_at || !record?.verification?.method) errors.push("verification receipt metadata is required");
  return { valid: errors.length === 0, errors };
}

export function listSourceFamilies({ q = "", category = "" } = {}) {
  const query = String(q).toLowerCase();
  return SOURCE_FAMILIES.filter((record) => {
    if (category && record.category !== category) return false;
    return !query || `${record.name} ${record.publisher.name} ${record.observations.join(" ")}`.toLowerCase().includes(query);
  });
}

export function getSourceFamily(id) {
  return SOURCE_FAMILIES.find((record) => record.id === id) || null;
}
