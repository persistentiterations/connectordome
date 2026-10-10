# Consequence receipts `v0.1alpha1`

Machine-readable schema: [`schemas/consequence-receipt.v0.1alpha1.schema.json`](../schemas/consequence-receipt.v0.1alpha1.schema.json).

A receipt records separately:

- what was proposed;
- whether the endpoint permitted it;
- whether it was attempted;
- the endpoint's reported outcome;
- the observed consequence, if any;
- evidence mode (`SIMULATION`, `REPLAY`, `REPORTED`, or `MEASURED`);
- uncertainty or missing evidence;
- correlation, formation, endpoint, operation, and observation time;
- the previous receipt hash and this receipt's SHA-256 hash.

`COMPLETED` without an observed consequence is HOLD. A valid hash proves internal receipt integrity, not truth in the physical world. `SIMULATION` must never be relabeled as measured evidence. External retention or reasoning systems can consume receipts without being embedded in ConnectorDome.

SPDX-License-Identifier: Apache-2.0
