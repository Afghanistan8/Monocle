#!/usr/bin/env node
/**
 * Local CI: runs the same checks as .github/workflows/ci.yml.
 *
 *   npm run ci
 *
 * Python tools are taken from ./.venv if present, otherwise from PATH
 * (install with `pip install . ./sdk/python`).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const win = process.platform === "win32";
const venvBin = join(root, ".venv", win ? "Scripts" : "bin");
const tool = (name) => {
  const local = join(venvBin, win ? `${name}.exe` : name);
  return existsSync(local) ? local : name;
};

const env = { ...process.env, GENVM_VERSION: process.env.GENVM_VERSION ?? "v0.6.0-rc5", PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };

const steps = [
  ...["Monocle", "MonocleFactory", "MonocleReputation"].map((c) => [
    `genvm-lint ${c}.py`,
    tool("genvm-lint"),
    ["check", join("contracts", `${c}.py`)],
  ]),
  ["gltest direct", tool("gltest"), ["tests/direct", "-q", "-p", "no:cacheprovider"]],
  ["gltest integration (skips without a node)", tool("gltest"), ["tests/integration", "-q", "-p", "no:cacheprovider"]],
  ["python SDK tests", tool("python"), ["-m", "pytest", "sdk/python/tests", "-q", "-p", "no:gltest", "-p", "no:cacheprovider"]],
  ["typescript typecheck", "npm", ["run", "-s", "typecheck"]],
  ["typescript SDK tests", "npm", ["run", "-s", "test:sdk"]],
];

const results = [];
for (const [label, cmd, args] of steps) {
  process.stdout.write(`\n=== ${label}\n`);
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: "inherit", shell: win });
  results.push([label, r.status === 0]);
  if (r.status !== 0) break;
}

console.log("\n=== summary");
for (const [label, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
const failed = results.some(([, ok]) => !ok) || results.length !== steps.length;
process.exit(failed ? 1 : 0);
