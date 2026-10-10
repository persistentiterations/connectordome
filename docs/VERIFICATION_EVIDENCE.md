# Verification evidence

Date: 2026-10-10 (America/New_York)  
Runtime: Node 24.13.0 locally; supported and CI minimum Node 22  
Wrangler: 4.149.0, exact development pin

## Commands and observed results

`npm ci`

```text
added 37 packages
found 0 vulnerabilities
```

`npm audit --audit-level=high`

```text
found 0 vulnerabilities
```

`npm test`

```text
tests 58
pass 58
fail 0
```

The repository count includes the acceptance test that decodes the actual API ZIP, independently checks every content hash and the declared digest scope, extracts to an operating-system temporary directory, imports and executes the adapter, injects invalid values, and invokes the packaged test command. Packaged output is required to contain `tests 5` and is rejected if it contains `tests 0`.

`npm run acceptance`

The runner starts Wrangler locally on loopback, checks `/health`, exercises `/api/preview` and `/api/build`, validates the ZIP and digest, runs the embedded-fixture adapter without ConnectorDome, forces a HOLD, and separately probes the real HTTPS fixture. The exact commit and hashes are machine-readable in `../artifacts/CONNECTORDOME_RELEASE_CANDIDATE_V0_1_2/ACCEPTANCE_RECEIPT.json`.

`npx wrangler deploy --dry-run --outdir .wrangler-dry-run`

```text
wrangler 4.149.0
Read 19 files from the assets directory
--dry-run: exiting now.
```

No deployment occurred.

`node src/cli.js inspect https://connectordome.com/fixtures/demo-station.json`

```text
reachability: OK
provenance_class: REMOTE_FEED
method: GET
```

The external source returned HTTP 200 during acceptance. Its availability is not part of the deterministic local pass criterion.

## Artifact identity

`verification.json` covers every package file except itself. It contains a sorted file-to-SHA-256 map and a SHA-256 digest of that canonical map. `package_hash` is independently the SHA-256 of the final ZIP, including `verification.json`; this avoids circular hashing. The current hashes are in the machine-readable receipt because they can change with any package source change.

## Production distinction

Production was read-only checked and returned HTTP 200, but `/health` reported version 0.1.0. Production is therefore evidence of the external source path only, not evidence that 0.1.2 is deployed. No staging or production mutation occurred.
