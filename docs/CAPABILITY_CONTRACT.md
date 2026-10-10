# Capability contract `v0.1alpha1`

Machine-readable schema: [`schemas/capability.v0.1alpha1.schema.json`](../schemas/capability.v0.1alpha1.schema.json).

A capability contract describes one independently governed endpoint. It declares identity and ownership, supported operations, constraints, local authority mode, local safety interlock, health, and revocation support. Discovery of this document never grants permission.

Required invariants:

- `authority.mode` is `LOCAL_EXPLICIT` and `authority.default` is `DENY`.
- `safety.local_interlock` is `true`; the coordinator cannot override it.
- authority is scoped to an endpoint and operation and may expire.
- stale observations, loss of communication, unavailable health, revocation, unsupported operations, or a local interlock all yield HOLD.
- vendor- or protocol-specific data may be added without requiring CF vocabulary.

The JavaScript validator is `validateCapabilityContract()` in `src/experimental/contracts.js`. This alpha contract may change incompatibly; adapters must check `contract_version`.

SPDX-License-Identifier: Apache-2.0
