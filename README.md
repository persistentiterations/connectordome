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
| **ConnectorDome** | Open connector ecosystem / builder / verifier / registry |
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

```bash
npm install
npm test
npx wrangler dev --port 8788
```

```bash
node src/cli.js inspect public/fixtures/demo-station.json
node src/cli.js package --kind web_api --url public/fixtures/demo-station.json --field temperature --capability weather.air.temperature --units C --name demo-station --out demo-station-0.1.0.zip
```

## Limitations (v0.1)

- MQTT is not implemented (coming next)
- STREAM means polled snapshots, not a socket bus
- Guest publication to the public registry is not implemented
- Generated-connector restrictions are not a hypervisor sandbox
- Heuristic mapping suggestions are not authority
- `CONFORMANCE_PASS` is not a safety certification

## Privacy / terms / security

- https://connectordome.com/privacy
- https://connectordome.com/terms
- https://connectordome.com/security

SPDX-License-Identifier: Apache-2.0
