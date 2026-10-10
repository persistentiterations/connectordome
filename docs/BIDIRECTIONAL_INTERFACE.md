# Asymmetric bidirectional interface

## Observation path (production v0.1)

Source → acquisition → validation → ASF `ReceptorEvent` → consumer.

Its permanent authority marker is `action_authority: NONE`. Upgrading ConnectorDome must not reinterpret an existing connector as executable.

## Proposal path (experimental simulation only)

Proposed step → endpoint discovery → dependency/conflict check → scoped authority → endpoint-local qualification → simulated attempt or refusal → consequence observation → hashed receipt.

The two paths use different objects, namespaces, and code. No experimental path is mounted in `src/worker.js`. Enabling the demo requires the explicit `--enable-simulation` flag. There is no live protocol adapter or physical output.

Third parties may implement adapters, validators, reasoning modules, or monitors through `connectordome.extension/v0.1alpha1`; an extension receives data and returns data but receives no implicit authority. Loading third-party code is always an explicit host decision.

SPDX-License-Identifier: Apache-2.0
