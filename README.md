# ConnectorDome

Public ASF connector registry and self-service builder.

**ONE INTERFACE TO OBSERVE. NO INTERFACE TO BLINDLY OBEY.**

ConnectorDome helps turn observable data sources into read-only ASF connectors.

There is one ASF. Users create connectors, not a new ASF.

## Local commands

```bash
cd connectordome
npm install
npm test
npx wrangler dev --port 8788
```

Open http://127.0.0.1:8788/

```bash
node src/cli.js inspect public/fixtures/demo-station.json
node src/cli.js run --kind web_api --url public/fixtures/demo-station.json --field temperature --capability weather.air.temperature --units C --time-field observed_at
node src/cli.js package --kind web_api --url public/fixtures/demo-station.json --field temperature --capability weather.air.temperature --units C --name demo-station --out demo-station-0.1.0.zip
node src/cli.js verify demo-station-0.1.0.receipt.json
```

(`dome verify` expects a manifest.json; the package command also writes a receipt.)

Production build/deploy (Cloudflare Worker + assets):

```bash
npx wrangler deploy
```

## v0.1 claim boundary

Not hardware attestation. Not industrial safety certification. Not an actuator. Not a truth engine.

MQTT: coming next. True WebSocket streaming: not in v0.1 (HTTP poll labeled polled_snapshot).

See `LICENSE_HOLD.md`.
