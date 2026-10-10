# Formation protocol `v0.1alpha1`

Machine-readable schema: [`schemas/formation.v0.1alpha1.schema.json`](../schemas/formation.v0.1alpha1.schema.json).

The reference protocol is a finite, correlation-scoped plan:

1. Discover an endpoint by exact identifier.
2. Check declared dependencies and conflicts.
3. Propose one operation with a fresh observation and scoped, expiring authority.
4. Let that endpoint qualify the proposal locally.
5. Attempt only after local PASS; otherwise return HOLD.
6. Record a consequence receipt.
7. Continue only after a verified completed consequence.
8. Dissolve after success, refusal, interruption, or failure.

There is no compulsory global controller, quorum service, or permanent formation identity. Only active participants are contacted, so reference-demo work scales with the number of selected steps. Partition tolerance here means safe refusal/HOLD, not guaranteed progress during a partition.

Run the deterministic three-endpoint demonstration:

```bash
npm run demo:experimental
```

SPDX-License-Identifier: Apache-2.0
