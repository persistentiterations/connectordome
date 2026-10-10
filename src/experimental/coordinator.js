import { validateFormationSpec } from "./contracts.js";
import { verifyReceiptChain } from "./receipts.js";

/**
 * Sparse coordinator: it proposes steps, but every endpoint qualifies locally.
 * It has no device drivers and cannot bypass a refusal.
 */
export async function runFormation(spec, endpoints, options = {}) {
  const validation = validateFormationSpec(spec);
  if (validation.status !== "PASS") return { status: "HOLD", phase: "SPECIFICATION", reasons: validation.errors, receipts: [] };
  if (options.featureEnabled !== true) return { status: "HOLD", phase: "FEATURE_FLAG", reasons: ["simulation feature disabled"], receipts: [] };

  const receipts = [];
  const completedOperations = new Set();
  for (const step of spec.steps) {
    if ((step.depends_on || []).some((dependency) => !completedOperations.has(dependency))) {
      return { status: "HOLD", phase: "DEPENDENCY", reasons: [`unmet dependency for ${step.id}`], receipts };
    }
    const conflicts = (step.conflicts_with || []).filter((operation) => completedOperations.has(operation));
    if (conflicts.length) return { status: "HOLD", phase: "CONFLICT", reasons: [`${step.id} conflicts with ${conflicts.join(",")}`], receipts };
    const endpoint = endpoints.get(step.endpoint_id);
    if (!endpoint) return { status: "HOLD", phase: "DISCOVERY", reasons: [`endpoint ${step.endpoint_id} unavailable`], receipts };

    const receipt = await endpoint.perform(step, {
      formation_id: spec.formation_id,
      correlation_id: spec.correlation_id,
      previous_receipt_hash: receipts.at(-1)?.receipt_hash ?? null,
    });
    receipts.push(receipt);
    if (receipt.reported_outcome !== "COMPLETED") {
      return { status: "HOLD", phase: "LOCAL_AUTHORITY", reasons: [receipt.reported_outcome], receipts, dissolved: true };
    }
    completedOperations.add(step.operation);
    completedOperations.add(step.id);
  }

  const chain = await verifyReceiptChain(receipts);
  if (chain.status !== "PASS") return { status: "HOLD", phase: "RECEIPT_VERIFICATION", reasons: [chain.reason], receipts };
  return { status: "PASS", phase: "DISSOLVED", reasons: [], receipts, dissolved: true };
}
