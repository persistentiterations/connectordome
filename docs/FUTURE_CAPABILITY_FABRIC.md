# Future capability and authority fabric — specified, not implemented

ConnectorDome v0.3 remains read-only. This proposal is a boundary specification, not a remote-control API.

1. A capability declaration identifies bounded possible transitions, constraints, local safe state, endpoint identity, and expiry.
2. An authority lease identifies the requester, scope, validity period, revocation mechanism, and required local checks.
3. The endpoint independently evaluates every request. Network loss, ambiguous state, expired authority, conflict, or safety interlock yields refusal/HOLD.
4. A consequence receipt records only observed endpoint outcome: completed, refused, interrupted, faulted, or unknown. A request is never evidence of completion.
5. Aggregate formations may advertise only the intersection or explicitly delegated composition of member capabilities. They cannot expand member authority.

Invariants: read access never grants write access; partitions only reduce authority; emergency stops remain endpoint-local; deterministic safety functions operate without cloud availability; no public observation endpoint receives an action method.
