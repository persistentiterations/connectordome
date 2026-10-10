# Known limitations — 0.1.2

- A connector currently emits one observation capability. Multiple-capability emission is deferred.
- Remote sources are HTTPS JSON snapshots acquired with GET. “Polling” means repeated snapshots; there is no streaming transport.
- Local CLI fixture paths and hosted builder fixtures are build inputs. Generated demo packages embed the fixture and do not retain a machine-specific path.
- Remote packages require their explicitly recorded external source to remain available. They do not require ConnectorDome.
- Field paths use backslash-escaped dots (`camera\.score`) or JSON Pointer (`/camera.score`).
- Freshness is derived from a validated source timestamp, configured threshold, and observation mode. Without a source time it is `UNKNOWN`; historical mode is `HISTORICAL`. Poll history remains null when unknown.
- Provenance verifies the observed acquisition class and contract properties. It does not authenticate publisher identity, hardware, or sensor custody.
- URL defenses reject non-HTTPS schemes, credentials, private/metadata IP literals, alternative IPv4 encodings after URL normalization, unsafe redirects, and private resolved addresses when a resolver is available. The Cloudflare Worker runtime ultimately supplies DNS and egress enforcement; this project does not claim race-free DNS pinning.
- IPv6 URL sources are conservatively rejected in 0.1.2 rather than partially supported.
- Secret scanning is defense-in-depth pattern matching, not proof that content is non-sensitive. Never place secrets in manifests, mappings, fixtures, or generated packages.
- No public registry publication exists. Registry entries are bundled demonstrations only.
- The industrial demo is simulated HTTPS JSON. It is not a PLC, camera stream, industrial protocol driver, control system, or safety system.
- There is no account system, telemetry requirement, advertising, actuation, robotics orchestration, or commercial feature in the candidate source. Cloudflare zone-level analytics must be checked separately before production deployment.
- MQTT, OPC UA, Modbus, EtherNet/IP, PROFINET, native video, Grok Bot-specific integration, hardware attestation, and dependencies on unfinished ecosystem research are out of scope.
