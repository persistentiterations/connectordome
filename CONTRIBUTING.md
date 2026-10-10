# Contributing

Fork, branch, test, submit a pull request.

```bash
npm test
```

Connector contributions in the current protocol generation must remain **read-only**.

Required for connector PRs:

- no embedded secrets
- provenance declared (`LIVE_LOCAL`, `REMOTE_FEED`, `TEST_FIXTURE`, `SIMULATION`, `REPLAY`, or `TEXT_CLAIM`)
- tests included
- license declared
- no mutating operations (`POST`/`PUT`/`PATCH`/`DELETE` as actuator surfaces)
- no actuation

Do not add analytics, accounts, or phone-home runtime in v0.1-compatible patches unless the change is explicitly scoped and tested.

Experimental extensions must remain under `src/experimental` or another explicitly isolated namespace, stay disabled by default, and include deterministic PASS/HOLD tests. Do not add live machinery or physical transports. Extension metadata uses `connectordome.extension/v0.1alpha1`; supported kinds are `adapter`, `validator`, `reasoning`, and `monitor`.

Every contribution should include:

- a declared license and provenance/evidence mode;
- a minimal reproducible fixture or example;
- tests covering refusal and failure, not only success;
- documentation that labels functioning, experimental, planned, and research-only behavior separately.

SPDX-License-Identifier: Apache-2.0
