/**
 * Regenerates frontend/lib/deployment.ts from deploy/deployments.json so the
 * web app's DEFAULT factory is always the recorded deployment, with no env
 * var needed. Called by 001/002; run by hand with `npm run sync:frontend`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deploymentDefaults, renderDeploymentModule } from "../sdk/typescript/src/deployments.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function writeFrontendDeployment(network = "studio-next"): string {
  const records = JSON.parse(readFileSync(join(ROOT, "deploy", "deployments.json"), "utf-8"));
  const defaults = deploymentDefaults(records, network);
  const target = join(ROOT, "frontend", "lib", "deployment.ts");
  writeFileSync(target, renderDeploymentModule(defaults));
  return defaults.factory;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const factory = writeFrontendDeployment(process.argv[2] ?? "studio-next");
  console.log(`frontend/lib/deployment.ts -> factory ${factory || "(none)"}`);
}
