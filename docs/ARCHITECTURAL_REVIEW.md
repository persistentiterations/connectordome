# Required architectural review

Status: completed for the software-only `v0.1alpha1` experiment. Physical actuation remains out of scope.

1. **Existing support.** ASF already supplies source identity, observation provenance, timestamp separation, freshness inputs, deterministic event identity, portable packages, verification, and the invariant `action_authority: NONE`.
2. **Standards reuse.** W3C WoT can describe properties/actions/events; MQTT can transport observations and receipts; OPC UA and ROS 2 can be adapter targets; SensorThings and NGSI-LD can supply observation/context models; MCP can expose developer-facing tools and resources. None alone supplies ConnectorDome's complete local qualification plus consequence-receipt boundary.
3. **New development.** Versioned capability, formation, extension, and receipt envelopes; local qualification rules; chain verification; and explicit evidence semantics.
4. **Decentralization.** The coordinator is disposable. Each endpoint keeps its own authority, constraint, safety, health, and revocation state. A partition produces HOLD.
5. **Non-bypassable local authority.** Only an endpoint can return a permitted receipt. The coordinator cannot mutate endpoint policy or turn a refusal into execution.
6. **Observation versus authorization.** v0.1 `ReceptorEvent.action_authority` stays `NONE`. Experimental proposals carry a separate, scoped, expiring authority object evaluated locally.
7. **Formation without robot identity.** A formation is a correlation-scoped list of steps and dependencies. It dissolves after completion or failure and does not re-identify participants as one agent.
8. **Physical versus reported consequence.** Receipts separately record proposal, permission, attempt, reported outcome, observed consequence, evidence mode, uncertainty, and a tamper-evident hash. Acknowledgment without evidence is HOLD.
9. **Smallest complete demonstration.** Three simulated endpoints—sensor, positioner, router—complete one dependency chain, generate linked receipts, and dissolve. No network or device driver exists.
10. **Falsification.** The claimed value is not earned if the distributed arrangement cannot outperform or complement a conventional dedicated arrangement on a declared workload after accounting for latency, failures, integration labor, energy, and coordination overhead. The present demo establishes mechanics only, not advantage.

## Track boundary

Track A remains the production read-only builder and registry. Track B lives only under `src/experimental`, is disabled unless explicitly enabled, and has no Worker route. Passing experimental tests is not safety certification.

SPDX-License-Identifier: Apache-2.0
