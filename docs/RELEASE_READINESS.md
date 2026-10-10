# Release readiness — 0.1.2

## Candidate status

The source tree is a production release candidate. It has not been deployed to production. As checked on 2026-10-10, `https://connectordome.com/health` still reports 0.1.0. The live homepage also contains a Cloudflare Web Analytics beacon; repository observability is disabled for this candidate, but the zone-level Web Analytics setting must be disabled or explicitly accepted during the authorized production change.

Release invariants:

- Apache-2.0 source and accountless guest building remain intact.
- Generated packages run without ConnectorDome and declare `phone_home: false`.
- All acquisition is read-only GET or embedded fixture access.
- `action_authority` and service actuation remain `NONE`.
- A HOLD response contains no ZIP or package files.
- Invalid values never become replacement observations.

## Reproducible gate

Run on Node 22 from a clean checkout:

```sh
npm ci
npm audit --audit-level=high
npm test
npm run acceptance
npx wrangler deploy --dry-run --outdir .wrangler-dry-run
node src/cli.js inspect https://connectordome.com/fixtures/demo-station.json
```

Expected evidence:

- dependency audit: zero known vulnerabilities;
- repository tests: 64 passed, 0 failed;
- extracted package tests: 6 passed, 0 failed for each of embedded-fixture and remote-HTTPS packages, never zero discovered;
- local Worker, guest build, ZIP extraction, adapter execution, HOLD gate: PASS;
- Worker dry-run completes without uploading;
- external HTTPS check is reported separately from deterministic local checks.

CI repeats this gate on Node 22 in `.github/workflows/release-acceptance.yml` and retains the receipt and dry-run bundle.

## Authorized deployment checklist

1. Require a green `release-acceptance` workflow on the exact commit.
2. Download the CI/review `ACCEPTANCE_RECEIPT.json`; require `release_commit` to equal the exact deployment commit, `release_tree` to match its Git tree, and `tracked_worktree_clean` to be true.
3. Confirm Cloudflare Web Analytics is disabled (or record an explicit policy exception); do not infer this from `wrangler.jsonc`.
4. Capture the currently deployed Worker version/configuration for rollback.
5. Deploy the exact reviewed commit only after explicit production approval.
6. Verify `/`, `/build`, `/docs`, `/health`, the demo fixture, a successful build, and a forced HOLD on both custom hostnames.
7. Confirm `/health` reports 0.1.2 and no analytics beacon is injected.
8. If any check fails, redeploy the captured prior release and preserve both receipts.

No production deployment, DNS change, charge, or live-data mutation is part of this repair commit.
