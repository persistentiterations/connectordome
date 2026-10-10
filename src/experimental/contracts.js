/**
 * Versioned, simulation-only extension contracts for ConnectorDome Track B.
 * Nothing in this module grants authority or exposes network/device I/O.
 * SPDX-License-Identifier: Apache-2.0
 */

export const EXPERIMENTAL_CONTRACT_VERSION = "connectordome.capability/v0.1alpha1";
export const RECEIPT_VERSION = "connectordome.consequence-receipt/v0.1alpha1";
export const FORMATION_VERSION = "connectordome.formation/v0.1alpha1";
export const EXTENSION_API_VERSION = "connectordome.extension/v0.1alpha1";

const REQUIRED_CAPABILITY_FIELDS = [
  "contract_version",
  "endpoint_id",
  "owner_id",
  "capability_id",
  "operations",
  "constraints",
  "authority",
  "safety",
  "health",
  "revocation",
];

export function validateCapabilityContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== "object") return { status: "HOLD", errors: ["contract must be an object"] };
  for (const field of REQUIRED_CAPABILITY_FIELDS) {
    if (!(field in contract)) errors.push(`missing ${field}`);
  }
  if (contract.contract_version !== EXPERIMENTAL_CONTRACT_VERSION) errors.push("unsupported contract_version");
  if (!Array.isArray(contract.operations) || contract.operations.length === 0) errors.push("operations must be non-empty");
  if (!Number.isInteger(contract.constraints?.max_observation_age_ms) || contract.constraints.max_observation_age_ms < 0) {
    errors.push("constraints.max_observation_age_ms must be a non-negative integer");
  }
  if (contract.authority?.mode !== "LOCAL_EXPLICIT") errors.push("authority.mode must be LOCAL_EXPLICIT");
  if (contract.authority?.default !== "DENY") errors.push("authority.default must be DENY");
  if (contract.safety?.local_interlock !== true) errors.push("local safety interlock is required");
  if (!contract.safety?.safe_state) errors.push("safety.safe_state is required");
  if (!contract.health?.status) errors.push("health.status is required");
  if (!contract.revocation?.supported) errors.push("revocation support is required");
  return { status: errors.length ? "HOLD" : "PASS", errors };
}

export function validateFormationSpec(spec) {
  const errors = [];
  if (spec?.formation_version !== FORMATION_VERSION) errors.push("unsupported formation_version");
  if (!spec?.formation_id) errors.push("formation_id required");
  if (!Array.isArray(spec?.steps) || spec.steps.length < 1) errors.push("at least one step required");
  const ids = new Set();
  for (const step of spec?.steps || []) {
    if (!step.id || ids.has(step.id)) errors.push(`invalid or duplicate step id: ${step.id || "<missing>"}`);
    ids.add(step.id);
    if (!step.endpoint_id || !step.operation) errors.push(`step ${step.id || "<missing>"} lacks endpoint_id or operation`);
  }
  return { status: errors.length ? "HOLD" : "PASS", errors };
}

export function validateExtension(extension) {
  const kinds = ["adapter", "validator", "reasoning", "monitor"];
  const errors = [];
  if (extension?.api_version !== EXTENSION_API_VERSION) errors.push("unsupported api_version");
  if (!kinds.includes(extension?.kind)) errors.push("unsupported extension kind");
  if (!extension?.name || !extension?.version) errors.push("name and version required");
  if (typeof extension?.handle !== "function") errors.push("handle(context) function required");
  return { status: errors.length ? "HOLD" : "PASS", errors };
}

export function registerExtensions(extensions = []) {
  const accepted = [];
  const rejected = [];
  for (const extension of extensions) {
    const result = validateExtension(extension);
    (result.status === "PASS" ? accepted : rejected).push({ extension, result });
  }
  return { accepted, rejected };
}
