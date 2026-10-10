import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unzipStore } from "../src/core/zip.js";
import { canonical, sha256hex } from "../src/core/asf.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run acceptance through `npm run acceptance` so npm_execpath is available");
const repositoryTestRun = spawnSync(process.execPath, [npmCli, "test"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
const repositoryTestOutput = `${repositoryTestRun.stdout}${repositoryTestRun.stderr}`;
assert.equal(repositoryTestRun.status, 0, repositoryTestOutput);
const repositoryTestCount = Number(repositoryTestOutput.match(/tests\s+(\d+)/)?.[1]);
assert.ok(repositoryTestCount > 0, "repository test count must be nonzero");
const port = 8791;
const origin = `http://127.0.0.1:${port}`;
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "connectordome-release-"));
const logs = [];
const child = spawn(process.execPath, [wrangler, "dev", "--local", "--ip", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  env: { ...process.env, NO_COLOR: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`LOCAL_APP_UNAVAILABLE\n${logs.join("")}`);
}

async function post(pathname, body) {
  const response = await fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  return JSON.parse(text);
}

const request = {
  kind: "web_api",
  url: "/fixtures/demo-station.json",
  name: "demo-station",
  mapping: {
    field: "temperature",
    capability: "weather.air.temperature",
    units: "C",
    data_type: "number",
    time_field: "observed_at",
    license: "Apache-2.0",
  },
};

try {
  const health = await waitForHealth();
  assert.equal(health.version, "0.1.2");
  assert.equal(health.actuation, "NONE");

  const preview = await post("/api/preview", request);
  assert.equal(preview.asf.value, 22.4);
  assert.equal(preview.asf.provenance_mode, "TEST_FIXTURE");

  const build = await post("/api/build", request);
  assert.equal(build.status, "CONFORMANCE_PASS");
  assert.equal(build.artifact_issued, true);
  const archive = Uint8Array.from(Buffer.from(build.zip_base64, "base64"));
  assert.equal(await sha256hex(archive), build.package_hash);
  const entries = unzipStore(archive);
  const verification = JSON.parse(new TextDecoder().decode(entries["verification.json"]));
  const hashes = {};
  for (const name of Object.keys(entries).filter((name) => name !== "verification.json").sort()) hashes[name] = await sha256hex(entries[name]);
  assert.deepEqual(hashes, verification.files);
  assert.equal(await sha256hex(canonical(hashes)), build.content_digest);

  for (const [name, bytes] of Object.entries(entries)) {
    const target = path.join(temp, ...name.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  const cleanEnv = { ...process.env };
  delete cleanEnv.NODE_TEST_CONTEXT;
  const packaged = spawnSync(process.execPath, ["--test", "tests/adapter.test.mjs"], { cwd: temp, encoding: "utf8", env: cleanEnv });
  const packagedOutput = `${packaged.stdout}${packaged.stderr}`;
  assert.equal(packaged.status, 0, packagedOutput);
  assert.match(packagedOutput, /tests 6/);
  const adapter = await import(`${pathToFileURL(path.join(temp, "adapter.mjs")).href}?acceptance`);
  const event = await adapter.sample();
  assert.equal(event.value, 22.4);
  assert.equal(event.action_authority, "NONE");
  assert.equal(event.provenance_mode, "TEST_FIXTURE");

  const hold = await post("/api/build", { ...request, mapping: { ...request.mapping, field: "missing" } });
  assert.equal(hold.status, "HOLD");
  assert.equal(hold.artifact_issued, false);
  assert.equal(Object.hasOwn(hold, "zip_base64"), false);

  let external = { status: "EXTERNAL_UNAVAILABLE", url: "https://connectordome.com/fixtures/demo-station.json" };
  try {
    const response = await fetch(external.url, { headers: { Accept: "application/json" } });
    const body = await response.json();
    external = { ...external, status: response.ok && body.temperature === 22.4 ? "EXTERNAL_PASS" : "EXTERNAL_INVALID", http_status: response.status };
  } catch (error) {
    external.error = error instanceof Error ? error.message : String(error);
  }

  const releaseCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const releaseTree = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const trackedChanges = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" }).stdout.trim();
  assert.equal(trackedChanges, "", `release acceptance requires a clean tracked worktree:\n${trackedChanges}`);
  const receipt = {
    schema: "connectordome.release-acceptance.v1",
    release: "0.1.2",
    release_commit: releaseCommit,
    release_tree: releaseTree,
    tracked_worktree_clean: trackedChanges === "",
    receipt_policy: "Generated after checkout and retained as external CI/review evidence; excluded from the release tree to avoid self-reference.",
    repository_tests: { status: "PASS", count: repositoryTestCount, command: "npm test" },
    local_worker: "PASS",
    guest_builder: "PASS",
    artifact_issued: true,
    artifact_sha256: build.package_hash,
    content_digest: build.content_digest,
    packaged_tests: { status: "PASS", count: 6 },
    adapter_execution: "PASS",
    hold_gate: "PASS",
    phone_home_required: false,
    external_https: external,
  };
  const evidenceDir = path.join(root, "artifacts", "CONNECTORDOME_RELEASE_CANDIDATE_V0_1_2");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "ACCEPTANCE_RECEIPT.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  child.kill();
  fs.rmSync(temp, { recursive: true, force: true });
}
