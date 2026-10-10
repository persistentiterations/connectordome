import { validateCapabilityContract } from "./contracts.js";
import { createConsequenceReceipt } from "./receipts.js";

export class SimulatedEndpoint {
  constructor(contract, options = {}) {
    const validation = validateCapabilityContract(contract);
    if (validation.status !== "PASS") throw new Error(`invalid capability contract: ${validation.errors.join(", ")}`);
    this.contract = structuredClone(contract);
    this.available = options.available ?? true;
    this.connected = options.connected ?? true;
    this.revoked = options.revoked ?? false;
    this.interrupted = options.interrupted ?? false;
    this.state = structuredClone(options.initialState || {});
    this.clock = options.clock || (() => new Date().toISOString());
  }

  qualify(proposal) {
    const now = Date.parse(proposal.now);
    const observed = Date.parse(proposal.observed_at);
    if (!this.connected) return hold("LOST_COMMUNICATION");
    if (!this.available || this.contract.health.status !== "AVAILABLE") return hold("ENDPOINT_UNAVAILABLE");
    if (this.revoked) return hold("AUTHORITY_REVOKED");
    if (proposal.authority?.endpoint_id !== this.contract.endpoint_id) return hold("PERMISSION_REFUSED");
    const expires = Date.parse(proposal.authority?.expires_at);
    if (!Number.isFinite(expires) || expires <= now) return hold("PERMISSION_EXPIRED");
    if (!proposal.authority?.operations?.includes(proposal.operation)) return hold("PERMISSION_REFUSED");
    if (!this.contract.operations.includes(proposal.operation)) return hold("UNSUPPORTED_OPERATION");
    if (!Number.isFinite(now) || !Number.isFinite(observed) || observed > now || now - observed > this.contract.constraints.max_observation_age_ms) return hold("STALE_OBSERVATION");
    if (this.contract.safety.blocked_operations?.includes(proposal.operation)) return hold("UNSAFE_OPERATION");
    return { status: "PASS", reason: "LOCAL_QUALIFICATION_PASS" };
  }

  async perform(proposal, context) {
    const qualification = this.qualify(proposal);
    const permitted = qualification.status === "PASS";
    let attempted = false;
    let outcome = qualification.reason;
    let observed = null;

    if (permitted) {
      attempted = true;
      if (this.interrupted) {
        outcome = "INTERRUPTED_SAFE_STATE";
        this.state = { ...this.state, mode: this.contract.safety.safe_state };
        observed = structuredClone(this.state);
      } else {
        outcome = "COMPLETED";
        this.state = { ...this.state, ...proposal.effects };
        observed = structuredClone(this.state);
      }
    }

    return createConsequenceReceipt({
      receipt_id: `${context.correlation_id}:${proposal.id}`,
      correlation_id: context.correlation_id,
      formation_id: context.formation_id,
      endpoint_id: this.contract.endpoint_id,
      operation: proposal.operation,
      proposed: true,
      permitted,
      attempted,
      reported_outcome: outcome,
      observed_consequence: observed,
      evidence_mode: "SIMULATION",
      uncertainty: permitted ? null : qualification.reason,
      observed_at: this.clock(),
      previous_receipt_hash: context.previous_receipt_hash,
    });
  }
}

function hold(reason) {
  return { status: "HOLD", reason };
}
