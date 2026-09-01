# Known limitations — ConnectorDome v0.1

- MQTT is COMING NEXT.
- STREAM is HTTP polled snapshots, not a WebSocket/MQTT bus.
- Generated-connector "sandbox" is static restriction (no shell, GET-only, SSRF on inspect), not a hypervisor.
- Guest builds are not persisted as public registry entries.
- No account/auth in v0.1.
- No LLM required; heuristic suggestions are not authority.
- License hold: no license selected.
- Zone DNS write is not on the Wrangler OAuth token; Worker custom domains and Email Routing DNS were used instead of generic dns_records create.
