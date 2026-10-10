import { canonical, sha256hex } from "../core/asf.js";
import { RECEIPT_VERSION } from "./contracts.js";

/** A receipt distinguishes a claim about execution from measured evidence. */
export async function createConsequenceReceipt(input) {
  const body = {
    receipt_version: RECEIPT_VERSION,
    receipt_id: input.receipt_id,
    correlation_id: input.correlation_id,
    formation_id: input.formation_id,
    endpoint_id: input.endpoint_id,
    operation: input.operation,
    proposed: input.proposed,
    permitted: input.permitted,
    attempted: input.attempted,
    reported_outcome: input.reported_outcome ?? "UNKNOWN",
    observed_consequence: input.observed_consequence ?? null,
    evidence_mode: input.evidence_mode || "SIMULATION",
    uncertainty: input.uncertainty ?? null,
    observed_at: input.observed_at,
    previous_receipt_hash: input.previous_receipt_hash ?? null,
  };
  return { ...body, receipt_hash: await sha256hex(canonical(body)) };
}

export async function verifyConsequenceReceipt(receipt) {
  if (receipt?.receipt_version !== RECEIPT_VERSION) return { status: "HOLD", reason: "unsupported receipt_version" };
  const { receipt_hash, ...body } = receipt || {};
  if (!receipt_hash) return { status: "HOLD", reason: "missing receipt_hash" };
  const expected = await sha256hex(canonical(body));
  if (expected !== receipt_hash) return { status: "HOLD", reason: "receipt hash mismatch" };
  if (receipt.attempted && !receipt.permitted) return { status: "HOLD", reason: "attempt recorded without permission" };
  if (receipt.reported_outcome === "COMPLETED" && (!receipt.permitted || !receipt.attempted || receipt.observed_consequence == null)) {
    return { status: "HOLD", reason: "completion reported without consequence evidence" };
  }
  return { status: "PASS", reason: "hash and evidence boundary verified" };
}

export async function verifyReceiptChain(receipts) {
  let previous = null;
  for (const receipt of receipts) {
    const verified = await verifyConsequenceReceipt(receipt);
    if (verified.status !== "PASS") return verified;
    if (receipt.previous_receipt_hash !== previous) return { status: "HOLD", reason: "receipt chain discontinuity" };
    previous = receipt.receipt_hash;
  }
  return { status: "PASS", reason: `${receipts.length} linked receipts verified` };
}
