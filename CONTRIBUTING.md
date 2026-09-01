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

SPDX-License-Identifier: Apache-2.0
