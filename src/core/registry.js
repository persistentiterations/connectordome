export const DEMO_CONNECTORS = [
  {
    id: "demo-industrial-observation",
    name: "Demo industrial observation fixture",
    source: "connectordome.com/fixtures/demo-industrial.json",
    type: "TEST FIXTURE",
    category: "Industrial",
    capabilities: ["machine.press.temperature", "machine.registration.offset", "vision.edge_alignment_score"],
    status: "DEMO",
    version: "0.1.2",
    publisher: "ConnectorDome",
    provenance_mode: "TEST_FIXTURE",
    read_only: true,
    actuation: "NONE",
    asf_compatibility: "ASF ReceptorEvent v0.1",
    verification: "CONFORMANCE_PASS",
    description: "Simulated HTTPS JSON observations; not a PLC, camera stream, or live industrial system.",
    demo: true,
    license: "Apache-2.0",
    generated_by: "ConnectorDome",
    generator_license: "Apache-2.0",
  },
  {
    id: "demo-station",
    name: "Demo weather station JSON",
    source: "connectordome.com/fixtures/demo-station.json",
    type: "TEST FIXTURE",
    category: "Weather",
    capabilities: ["weather.air.temperature"],
    status: "DEMO",
    version: "0.1.2",
    publisher: "ConnectorDome",
    provenance_mode: "TEST_FIXTURE",
    read_only: true,
    actuation: "NONE",
    asf_compatibility: "ASF ReceptorEvent v0.1",
    verification: "CONFORMANCE_PASS",
    description: "Demonstration JSON fixture. Not a live weather network.",
    demo: true,
    license: "Apache-2.0",
    generated_by: "ConnectorDome",
    generator_license: "Apache-2.0",
  },
  {
    id: "demo-sim-battery",
    name: "Demo simulated battery",
    source: "simulator",
    type: "SIMULATOR",
    category: "Simulation",
    capabilities: ["battery.charge_percent"],
    status: "DEMO",
    version: "0.1.2",
    publisher: "ConnectorDome",
    provenance_mode: "SIMULATION",
    read_only: true,
    actuation: "NONE",
    asf_compatibility: "ASF ReceptorEvent v0.1",
    verification: "CONFORMANCE_PASS",
    description: "Seeded simulator. Not a physical battery.",
    demo: true,
    license: "Apache-2.0",
    generated_by: "ConnectorDome",
    generator_license: "Apache-2.0",
  },
  {
    id: "demo-text-claim",
    name: "Demo text claim",
    source: "operator text",
    type: "TEXT CLAIM",
    category: "Other",
    capabilities: ["text.claim.numeric"],
    status: "DEMO",
    version: "0.1.2",
    publisher: "ConnectorDome",
    provenance_mode: "TEXT_CLAIM",
    read_only: true,
    actuation: "NONE",
    asf_compatibility: "ASF ReceptorEvent v0.1",
    verification: "CONFORMANCE_PASS",
    description: "Operator statement. Not a sensor.",
    demo: true,
    license: "Apache-2.0",
    generated_by: "ConnectorDome",
    generator_license: "Apache-2.0",
  },
];

export const CATEGORIES = [
  "Industrial",
  "Weather",
  "Earth",
  "Space",
  "Energy",
  "Telecom",
  "Vehicles",
  "Laboratory",
  "Agriculture",
  "Buildings",
  "Computing",
  "Public Data",
  "Simulation",
  "Other",
];

export function searchRegistry(q = "", category = "") {
  const query = String(q || "").toLowerCase();
  return DEMO_CONNECTORS.filter((c) => {
    if (category && c.category !== category) return false;
    if (!query) return true;
    const blob = `${c.name} ${c.source} ${c.type} ${c.capabilities.join(" ")} ${c.category}`.toLowerCase();
    return blob.includes(query);
  });
}

export function getConnector(id) {
  return DEMO_CONNECTORS.find((c) => c.id === id) || null;
}
