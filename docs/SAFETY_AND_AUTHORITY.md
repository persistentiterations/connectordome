# Safety and authority boundary

Production v0.1 is observation-only. Experimental code is software-only, disabled by default, and cannot reach devices.

For any future physical adapter, the minimum boundary is:

- explicit, endpoint-scoped, operation-scoped, expiring authority;
- local default-deny policy and device-specific interlocks;
- revocation, watchdog, safe-state transition, and interruption behavior;
- partition-safe refusal/HOLD;
- no conversion of observation, discovery, model output, or coordinator intent into permission;
- auditable receipts that distinguish acknowledgment from measured consequence;
- independent safety engineering appropriate to the actual device.

No universal stop command is presumed. Aircraft, medical equipment, public traffic control, electrical-grid infrastructure, and other safety-critical systems are not authorized targets. An AI-generated plan must never bypass a qualified execution boundary.

SPDX-License-Identifier: Apache-2.0
