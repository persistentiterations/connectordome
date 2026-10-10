# ConnectorDome v0.1.2 production deployment

Date: 2026-10-10 (America/New_York)  
Final verdict: **LIVE — CONNECTORDOME v0.1.2 VERIFIED**

## Release identity

- Approved source commit: `a19caf7db4c92f7e53ab43ec052ec0fc3c2a8daf`
- Approved source tree: `7067cae853f4f59759ef36527535ec1b3d537107`
- GitHub merge commit: `7aa42fd5694203b29f89da2e1f417317130a3626`
- Merge tree: `7067cae853f4f59759ef36527535ec1b3d537107` (identical to the approved source tree)
- Pull request: `https://github.com/persistentiterations/connectordome/pull/1`
- GitHub Actions workflow: `release-acceptance`, successful on the approved source commit
- Successful job: `https://github.com/persistentiterations/connectordome/actions/runs/38073650303/job/114276008945`

## Cloudflare deployment

- Worker: `connectordome`
- Production version: `6d917aa5-5e50-4534-b7e6-44062cac003d`
- Deployment: `73c0181c-a5d0-48ae-81dd-1a640286cabb`
- Deployed at: `2026-10-10T18:16:39.879985Z`
- Hostnames: `connectordome.com`, `www.connectordome.com`, and the existing `connectordome.flexpadm.workers.dev` route
- Binding: existing `ASSETS` binding only
- Worker observability: disabled by repository configuration
- Zone Web Analytics/RUM: `off`, confirmed through the zone-scoped API after deployment

Before deployment, only the two cached homepage URLs (`https://connectordome.com/` and `https://www.connectordome.com/`) were purged. No other zone, hostname path, Worker, DNS record, security setting, or account-wide configuration was changed.

## Verification

Commands:

```text
npm ci
npm test
npm run acceptance
npx wrangler deployments status --json
npx wrangler versions list --json
npx wrangler versions view 3aefda64-8284-43e9-9300-e3a5f09f3e48 --json
npx wrangler deploy
node artifacts/CONNECTORDOME_RELEASE_CANDIDATE_V0_1_2/production-smoke.mjs
node artifacts/CONNECTORDOME_RELEASE_CANDIDATE_V0_1_2/production-remote-smoke.mjs
```

Results:

- Dependencies: clean install; zero known vulnerabilities.
- Repository tests: 64 passed, 0 failed.
- Local release acceptance: PASS.
- Embedded package tests: 6 passed, 0 failed.
- Remote HTTPS package tests: 6 passed, 0 failed.
- Both generated adapters executed independently.
- Public apex and `www` routes `/`, `/build`, `/docs`, `/health`, `/fixtures/demo-station.json`, `/connectors`, and `/connectors/demo-station`: HTTP 200.
- Both `/health` routes: version `0.1.2`, actuation `NONE`.
- Guest fixture package SHA-256: `1a6119d23f5bbedfe6ecc70326ba5d8d70fb0add2f5f932325c579e3906ca7b4`.
- Remote HTTPS package SHA-256: `3cb1a7af4fb53f557af6fc054dae0bf0e826c91751a212fe10f8115d45ca45be`.
- Evidence hashes and `verification.json` status consistency: PASS.
- Forced HOLD: no ZIP or downloadable verified artifact issued.
- Valid calendar timestamps: PASS.
- Impossible calendar, clock, and future timestamps: rejected with `INVALID_TIMESTAMP`.
- Generated events: `action_authority: NONE`.
- Cloudflare Web Analytics beacon: absent from apex and `www` public HTML after the URL-scoped purge.
- Account requirement: none.

Production verification above used direct HTTP/API requests and independent Node.js execution. It does not claim a full visual-browser or device-lab accessibility certification.

## Rollback

The previous known-good deployment was captured before release:

- Previous Worker version: `3aefda64-8284-43e9-9300-e3a5f09f3e48`
- Previous deployment: `6e6bd977-b62f-44dd-ace8-c50b433a58dd`
- Previous production version was at 100% traffic.
- Restore command: `npx wrangler rollback 3aefda64-8284-43e9-9300-e3a5f09f3e48`

Rollback affects only the existing `connectordome` Worker. It does not require DNS or unrelated resource changes.

## Known limitations

- One observation capability is emitted per connector.
- Remote acquisition is HTTPS GET for JSON snapshots; polling is not a streaming transport.
- The Node CLI pins validated IPv4 destinations. Cloudflare Workers relies on platform egress protections and does not claim application-level DNS pinning.
- Offline digests establish internal integrity relative to trusted issuance evidence; they do not authenticate publishers or resist fully replaced and re-signed evidence.
- `ADVANCED`, MQTT, OPC UA, Modbus, native camera streaming, physical actuation, hardware attestation, and autonomous industrial control are not implemented.
- The industrial example is explicitly simulated.

## Public capability

ConnectorDome v0.1.2 is a free, open-source, accountless builder for portable, read-only observation connectors. Users can inspect supported JSON sources, map observations into structured ASF events with explicit provenance, preview conformance, download independently runnable packages, and verify packaged evidence without a ConnectorDome account or runtime.
