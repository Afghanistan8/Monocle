/**
 * Opens a live test market on the deployed factory and runs it up to a
 * real adjudication, so the whole stack can be checked end to end.
 *
 *   npx tsx --env-file-if-exists=.env deploy/002_open_test_market.ts [studio-next|localnet]
 *
 * Uses PRIVATE_KEY from .env and the factory recorded in deployments.json.
 * Spends: 2 x min_interpretation_bond + network fees.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createWriteClient, FactoryCalls, MonocleCalls, resolveNetwork, type Address } from "../sdk/typescript/src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function step(msg: string) {
  console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  const networkName = process.argv[2] ?? "studio-next";
  const chain = resolveNetwork(networkName);
  const records = JSON.parse(readFileSync(join(ROOT, "deploy", "deployments.json"), "utf-8"));
  const factoryAddress = records[networkName]?.factory as Address | undefined;
  if (!factoryAddress) throw new Error(`No factory recorded for ${networkName}; run 001 first.`);
  const key = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) throw new Error("Set PRIVATE_KEY in .env");

  const client = createWriteClient({ account: key, chain });
  const factory = new FactoryCalls(client, factoryAddress);

  step("Creating Monocle…");
  const { monocle } = await factory.createMonocle({
    sources: ["https://en.wikipedia.org/wiki/Speed_of_light", "https://simple.wikipedia.org/wiki/Speed_of_light"],
    interpretationType: "research",
    title: "What is the speed of light in vacuum?",
    description: "Live test market: which interpretation do the cited encyclopedia pages support?",
    schema: { value_m_per_s: "speed of light in metres per second" },
  });
  console.log(`Monocle: ${monocle}`);

  const m = new MonocleCalls(client, monocle);
  const info = await m.getInfo();
  const bond = BigInt(info.min_interpretation_bond);

  step("Submitting the correct interpretation…");
  await m.submitInterpretation(
    "Light in vacuum travels at exactly 299,792,458 metres per second; the metre is defined from it.",
    {
      claims: [
        "The speed of light in vacuum is exactly 299,792,458 metres per second",
        "The metre is defined using the speed of light",
      ],
      value_m_per_s: "299792458",
    },
    bond,
  );

  step("Submitting a wrong interpretation…");
  await m.submitInterpretation(
    "Light in vacuum travels at roughly 150,000 kilometres per second.",
    { claims: ["The speed of light in vacuum is about 150,000 kilometres per second"], value_m_per_s: "150000000" },
    bond,
  );

  step("Adjudicating (validators fetch both pages and judge every claim)…");
  await m.adjudicate();

  const round = await m.getRoundInfo("1");
  const reasoning = round.reasoning as Record<string, unknown>;
  step("Result");
  console.log(
    JSON.stringify(
      {
        monocle,
        status: round.status,
        decision: reasoning.decision,
        reason: reasoning.reason,
        pending_winner: round.pending_winner,
        confidence: reasoning.confidence,
        composite_score: reasoning.composite_score,
        sources_fetched_ok: reasoning.sources_fetched_ok,
        challenge_deadline: round.challenge_deadline,
        reasoning: reasoning.reasoning,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
