# ConnectorDome

Build read-only ASF connectors for sensors, instruments, machines, APIs and public data.

Free. No account required.

Paste a source.
Map what it observes.
Test it.
Take the connector with you.

**ONE INTERFACE TO OBSERVE. NO INTERFACE TO BLINDLY OBEY.**

Site: https://connectordome.com

ConnectorDome is an open-source project stewarded by BonAcqui LLC.

## What this is

| Name | Role |
| --- | --- |
| **ConnectorDome** | Open connector builder and verifier with bundled demo listings |
| **ASF** | APTD Sensor Fabric interoperability standard |
| **ReceptorLink** | ASF adapter contract |
| **APTD** | Future governed physical transition boundary |
| **Fractalish** | Research lineage |
| **BonAcqui LLC** | Project steward |

You do not need to understand Fractalish or APTD to build a connector.

There is one ASF. Users create connectors, not a new ASF.

## Guest flow

1. CONNECT — paste a URL, OpenAPI, simulator, or text claim
2. MAP — name the observation, unit, and time field
3. USE — preview a ReceptorEvent, run the verifier, download a portable zip

No account. No phone-home runtime. No actuation.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.

Generated connector packages record `generated_by: ConnectorDome` and `generator_license: Apache-2.0`. The connector’s own license is the publisher’s responsibility and defaults to `UNSPECIFIED` unless chosen.

## Local commands

Node.js 22 or newer is required by the pinned Wrangler toolchain.

```bash
npm ci
npm test
npm run acceptance
npx wrangler dev --port 8788
```

```bash
node src/cli.js inspect public/fixtures/demo-station.json
node src/cli.js package --kind fixture --url public/fixtures/demo-station.json --field temperature --capability weather.air.temperature --units C --data-type number --time-field observed_at --name demo-station --out demo-station-0.1.2.zip

# after extracting the ZIP
node src/cli.js verify path/to/extracted-package
```

Generated packages contain `verification.json`; its content digest covers every package file except `verification.json` itself. The enclosing ZIP has a separate SHA-256 hash in the build receipt.

Field paths use dots for nesting and backslash-escaped dots for literal key names: `machine.temperature` is nested, while `sensor\.temperature` addresses the literal key `sensor.temperature`. JSON Pointer syntax such as `/sensor.temperature` is also accepted.

## Limitations (v0.1.2 release candidate)

- MQTT is not implemented and has no release date
- POLLING means repeated HTTPS snapshots, not a socket or event bus
- Guest publication to the public registry is not implemented
- One observation capability is emitted per generated connector; multiple-capability generation is deferred
- Remote adapters support public HTTPS JSON GET only; no native PLC, camera, industrial-bus, or video transport is implied
- DNS resolution cannot be independently inspected inside the Worker runtime; URL normalization, literal-address, redirect, and platform egress protections remain defense-in-depth rather than a network sandbox proof
- Generated-connector restrictions are not a hypervisor sandbox
- Heuristic mapping suggestions are not authority
- `CONFORMANCE_PASS` is not a safety certification

## Experimental architecture (isolated)

The production v0.1 path remains observation-only. A separate, disabled-by-default software simulation explores endpoint-local authority, temporary three-endpoint formations, and consequence receipts:

```bash
npm run demo:experimental
```

The demo has no device drivers, network transports, Worker routes, or physical output. Start with [`docs/ARCHITECTURAL_REVIEW.md`](docs/ARCHITECTURAL_REVIEW.md), then see the [capability contract](docs/CAPABILITY_CONTRACT.md), [formation protocol](docs/FORMATION_PROTOCOL.md), [receipts](docs/CONSEQUENCE_RECEIPTS.md), [safety boundary](docs/SAFETY_AND_AUTHORITY.md), and [interoperability matrix](docs/INTEROPERABILITY_MATRIX.md).

## Open ecosystem

Third parties can build adapters, validators, reasoning modules, and monitors against versioned Apache-2.0 contracts without permission from BonAcqui LLC. ConnectorDome has no required Fractalish, SymLan, ExoMCP, Anti-Illogical, advertising, account, telemetry, or proprietary dependency. See [`docs/ECOSYSTEM.md`](docs/ECOSYSTEM.md) for factual status labels and public project links.

Release evidence: [accepted repairs](docs/INDEPENDENT_ACCEPTANCE_REPAIRS.md), [readiness and rollback](docs/RELEASE_READINESS.md), [verification evidence](docs/VERIFICATION_EVIDENCE.md), and [known limitations](docs/KNOWN_LIMITATIONS.md).

## Privacy / terms / security

- https://connectordome.com/privacy
- https://connectordome.com/terms
- https://connectordome.com/security

SPDX-License-Identifier: Apache-2.0
