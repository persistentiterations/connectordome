# ConnectorDome v0.3 architecture delta

Status: **IMPLEMENTED BUT NOT INTEGRATION-TESTED** for the fixture-first prototype. No production deployment is implied.

## What v0.3 adds

- An Open Sensorium source-family registry. Each record keeps publisher, official documentation, endpoint example, permissions, uncertainty/quality declarations, rate-limit notes, and a dated connection check. `UNKNOWN` is a valid value, not a gap to fill with inference.
- A Global Grounding Reference (GGR) declaration for a bounded EPSG:4326 reference, its timing and spatial uncertainty, validity interval, provenance, and simulation status.
- Deterministic `ANCHOR`, `FRAME`, `DELTA`, and `TRACE` operations. Frames retain included observations, explicit exclusions, coverage, integrity data, and a versioned correction chain.
- A browser-visible simulated demonstration with three source families and seven visible failure paths. The eighth required condition—mobile reference change—is covered by deterministic API tests.

## What remains deliberately out of scope

There is no live global polling service, universal coordinate transform service, reference authority, actuation, ROS installation test, external source adapter, user account, telemetry requirement, or production deployment in this branch. The frame demo uses simulated observations and marks them as such. Source-family records are documentation and verification evidence, not a claim that ConnectorDome redistributes those sources' data.

## Protocol endpoints

| Operation | Method and path | Result |
| --- | --- | --- |
| Registry | `GET /api/sensorium/sources` | Filterable source-family records |
| ANCHOR | `POST /api/ggr/anchor` | Resolved reference with canonical anchor ID |
| FRAME | `POST /api/ggr/frame` | Canonical observation frame and coverage/exclusions |
| DELTA | `POST /api/ggr/delta` | Recorded differences between compatible frames |
| TRACE | `POST /api/ggr/trace` | Inclusion and exclusion provenance |
| Demo | `GET /api/ggr/demo?scenario=…` | Fixture-only browser demonstration |

All responses declare `action_authority: "NONE"`. A read path is not a future authorization path.

## Security and integrity boundaries

The existing HTTPS-only GET/SSRF protections govern connector acquisition. GGR inputs are bounded JSON and use strict timestamp validation. Frame inclusion verifies a SHA-256 digest over the declared observation payload, rejects incompatible references rather than inventing transforms, and reports unavailable, stale, invalid, tampered, and unauthorized-use inputs as exclusions. Frame hashes establish internal reproducibility, not publisher authenticity or hardware custody.

## Operating-cost posture

The registry and demonstration are static assets plus pure Worker computation. No database, scheduler, background polling, mandatory external call, account, or telemetry is introduced. Live adapters remain a later, source-specific responsibility with documented rate, permission, and caching limits.
