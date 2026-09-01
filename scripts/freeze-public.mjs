import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { sha256hex } from "../src/core/asf.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "artifacts", "CONNECTORDOME_PUBLIC_V0_1_1");
fs.mkdirSync(out, { recursive: true });

function write(name, obj) {
  const text = typeof obj === "string" ? (obj.endsWith("\n") ? obj : obj + "\n") : JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(path.join(out, name), text);
}

const tests = spawnSync(process.execPath, ["--test", "tests/core.test.js", "tests/publication.test.js"], {
  cwd: root,
  encoding: "utf8",
});
write("TEST_RECEIPT.json", { returncode: tests.status, stdout: (tests.stdout || "").slice(-3000), node: process.version });
write("LICENSE_RECEIPT.json", { license: "Apache-2.0", steward: "BonAcqui LLC", core_tag_untouched: "CONNECTORDOME_CORE_V0_1" });
write("PUBLICATION_NOTES.md", `# ConnectorDome Public v0.1.1

Does not rewrite CONNECTORDOME_CORE_V0_1.

Adds Apache-2.0, NOTICE, privacy/terms/security, GitHub publication, BonAcqui portfolio listing.
`);
const files = fs.readdirSync(out).filter((n) => n !== "FREEZE_MANIFEST.json");
const hashes = {};
for (const n of files.sort()) hashes[n] = await sha256hex(fs.readFileSync(path.join(out, n)));
write("FREEZE_MANIFEST.json", {
  name: "CONNECTORDOME_PUBLIC_V0_1_1",
  created_at: new Date().toISOString(),
  tests_returncode: tests.status,
  files: hashes,
  branched_from: "CONNECTORDOME_CORE_V0_1",
});
console.log(out, "tests", tests.status);
