# Independent acceptance repairs

Release candidate: ConnectorDome 0.1.2  
Evaluated baseline: `b6c0afba99137b3df19945f9ac771ab5b7362652`  
Repair branch: `codex/open-ecosystem-architecture`

The initial repository suite reported 46 passing tests and zero failures, but it did not execute an extracted guest package. Manual reproduction confirmed the five P0 defects. The repaired suite has 58 repository tests, including a clean-room archive test; the generated package has five independently discovered tests.

## Accepted findings and repairs

| Finding | Minimal reproduction and root cause | Repair | Regression evidence | Result |
| --- | --- | --- | --- | --- |
| Demo package could not sample | Build `/fixtures/demo-station.json`; the manifest carried `source_url: null` and the adapter attempted a remote fetch. A same-origin build fixture had no portable runtime meaning. | Fixture acquisition is recorded as `TEST_FIXTURE`; the exact JSON is embedded as `fixture.json` and addressed by `embedded:fixture.json`. Remote packages retain an explicit final HTTPS URL. | `guest demo builds, extracts, executes and tests cleanly` | PASS |
| Invalid numeric input fabricated zero or null | `Number(null)`, `Number("")`, and `Number(" ")` are zero; JSON serializes `NaN` as null. | One strict normalizer is used by preview and generated runtime. Numeric strings must match a finite decimal/scientific grammar. Null, blanks, whitespace-padded strings, incompatible types, and non-finite values produce `MISSING_VALUE` or `TYPE_MISMATCH`. | `strict numeric normalization never fabricates zero`; five generated tests | PASS |
| Preview and adapter differed | Preview emitted a ReceptorEvent while generated `adapter.mjs` emitted a reduced object. | `observation.js` defines the authoritative event contract and emits the equivalent self-contained runtime module. It preserves the source/receipt/ingestion time distinction and validates `time_field`. | `preview and runtime have equivalent event semantics` | PASS |
| HOLD could still download | Browser logic contained an always-false disabling branch, and stale success state survived later failures. The backend returned candidate files even on HOLD. | The browser clears prior state before every build. The backend returns no ZIP or package files unless verification passes. HOLD manifests say HOLD and have no evidence digest. | `HOLD never issues a verified artifact and stale success cannot be reused`; local worker acceptance | PASS |
| Packaged test command found zero tests | The archive used a filename outside Node's discovery pattern. | Package test is `tests/adapter.test.mjs`; its command is `node --test tests/*.test.mjs`. Acceptance requires the output to report five tests, not zero. | Extracted archive test plus local-worker runner | PASS |
| Old observations appeared current | Age was not evaluated and `missed_polls` was hard-coded to zero. | A versioned freshness extension reports `FRESH`, `STALE`, `HISTORICAL`, or `UNKNOWN`; `source_health` follows it. Thresholds are configurable, historical mode is explicit, and unknown poll history is null. | `freshness distinguishes fresh stale historical and unknown` | PASS |
| Provenance validation was circular | Expected provenance was derived from the same declared kind being checked. Fixture website and CLI paths disagreed. | Manifests separate `source_declared`, `source_observed`, `provenance_declared`, `provenance_observed`, and `provenance_verified`. The worker reacquires the source instead of accepting a client-supplied inspection. | Provenance-mode tests; contradictory real API build test | PASS |
| Input/security validation was incomplete | Empty capability, unknown type, malformed JSON/OpenAPI, literal-dot paths, encoded IPs, redirects, and DNS answers lacked complete tests. | Added declaration validation, JSON/OpenAPI errors, escaped dot and JSON Pointer paths, normalized-host checks, manual redirect validation, optional DNS-address policy, stronger secret scanning, and controlled SSRF fixtures. | `invalid mapping declarations fail clearly`; `DNS and redirect SSRF defenses use controlled fixtures`; related tests | PASS with DNS limitation documented |
| Toolchain/docs/UI drift | Wrangler required a newer Node than documented; health/copy/STREAM wording and mobile targets were inconsistent. | Node 22 is required. Wrangler is exactly pinned to 4.149.0. Health reports 0.1.2 candidate. “STREAM” is “polling,” publication is not promised, source limits are explicit, and tap targets are at least 44 px. | Clean `npm ci`; zero-vulnerability audit; dry-run Worker build; publication tests | PASS |
| No modest industrial example | Existing demos did not speak to industrial researchers. | Added a plainly simulated HTTPS JSON example with press state, temperature, registration offset, and camera-derived numeric score. It explicitly disclaims native camera, PLC, and actuation support. | Registry and no-actuation tests | PASS |

## Disputed or deferred findings

### Alternative IPv4 encodings

The proposed decimal/hexadecimal bypass was not reproducible with the current WHATWG URL parser: decimal, hexadecimal, and octal loopback spellings normalize to `127.0.0.1` and are rejected. This is not treated as a current bypass. Tests were added so parser behavior cannot silently regress.

### Multiple observations per connector

Only the first configured capability is supported. Expanding package/runtime/event verification to multiple observations is useful but not needed to repair the trust invariant, so 0.1.2 rejects the implication that it is supported and documents the limit.

### DNS enforcement

Controlled tests prove that private DNS results are rejected when resolution results are available. Cloudflare Worker code has no portable, race-free DNS-resolution hook; production still relies on Cloudflare egress controls after application-level scheme, hostname, IP-literal, and redirect checks. This is a documented boundary, not a claim of authenticated network provenance.

### Deferred scope

MQTT, OPC UA, Modbus, EtherNet/IP, PROFINET, native video, Grok Bot integration, actuation, robotics orchestration, public registry publication, hardware attestation, accounts, and commercial features remain unimplemented.
