# MONOCLE

**A capital-backed, claim-level, challengeable interpretation engine on GenLayer Intelligent
Contracts.** It targets **GenLayer Studio Next** (Consensus v0.6 RC, chain 61997).

Anyone can open a Monocle on two or more live sources. Participants bond GEN behind competing
structured interpretations of what those sources say. Anyone can trigger adjudication. The leader
fetches every source fresh, and validators independently re-fetch and re-reason.

A confident, corroborated, claim-consistent verdict becomes **pending**. It becomes the **FINAL**
live output once its challenge window passes or a bonded challenge resolves. Other agents and
contracts read that output. A new round then opens, so the output keeps tracking a changing world.
Zero evidence, low confidence or an invalid verdict never move stake, and every round ends
claimable.

## Live on Studio Next

| | |
| --- | --- |
| Web app | https://monocle-ten.vercel.app |
| MonocleFactory | [`0x6e9bfAd92A1a34310c29ce099C3bc83E2bAef48e`](https://explorer-studio-dev.genlayer.com/address/0x6e9bfAd92A1a34310c29ce099C3bc83E2bAef48e) |
| MonocleReputation | `0x722261Db07AB7A28C7f50899E3083891F79003de` |
| Seeded demo market | [`0xCa8298520a4b5dF9040325D9cF45000D910D04Bb`](https://monocle-ten.vercel.app/m/0xCa8298520a4b5dF9040325D9cF45000D910D04Bb) (speed of light, two Wikipedia sources) |
| Challenge window | **3 minutes on this demo deployment** (production default: 1 hour) |
| Network | GenLayer Studio Next, chain 61997, RPC `https://studio-dev.genlayer.com/api` |

Studio Next is a release-candidate network and its state can be reset; treat these addresses as
ephemeral. `deploy/deployments.json` is the source of truth. Check the live system with:

```bash
npm run check:studio-next
```

It exits 0 only if the chain id is 61997, the factory has code and every factory view answers.

This repository contains the contracts, tests, a deploy script, TypeScript and Python agent SDKs,
the web app (`frontend/`), and docs.

## What makes it different

| Property | How MONOCLE does it |
| --- | --- |
| Claim-level judgment | Every claim of every interpretation is scored `supported / contradicted / insufficient`. Support must cite a source that actually fetched. A deterministic roll-up must agree with the model's pick. A contradicted core claim disqualifies, unless the interpretation's stance is `refutation` |
| Fail-closed verdicts | No evidence, confidence below 0.62, an unknown winner id, an inconsistent ranking, or fewer than 2 corroborating sources all make the round inconclusive with full refunds |
| Finality with a challenge window | A verdict is pending for 1h. Anyone can post a bonded `challenge`, which a pairwise `resolve_challenge` settles before `finalize` publishes the FINAL output |
| Change detection | Fetched evidence is content-hashed in contract code. Unchanged evidence with nothing new submitted short-circuits to `unchanged`: no model call, full refunds |
| Source governance | Up to 8 sources with roles (primary / corroborating / contradicting), per-source hashes and fetch status. Sources are append-only, and additions are bonded: refunded once the source fetches, forfeited after repeated misses |
| Spam controls | Interpretation bond, per-round content-hash dedup, source bond, challenge bond |
| No grief-closing | Close runs on a 2h timelock. Backers can still adjudicate during it, and close waits for any pending verdict |
| No stranded stake | Every path ends claimable: timeouts, stuck challenges, close, source bonds, rounding dust |
| Exact fees | The factory keeps exactly `creation_stake` and refunds any overpayment |
| Agent-grade views | Paginated and typed: `finality`, evidence hash and snapshot, fetch report, claim scores, roll-ups, vault state |
| Reputation | Each Monocle keeps a local ledger, and a separate `MonocleReputation` aggregator pulls from all of them. Reputation is **never** an input to judgment |

Core safety rules:

* adjudication is stake-blind and author-blind;
* validators re-derive the verdict independently;
* evidence is sliced from real fetched text, never from the model;
* there is exactly one nondet block per method;
* storage holds no floats;
* addresses are normalized;
* time comes from consensus;
* ledger effects happen before any transfer;
* the only owner privilege is fee withdrawal.

See [docs/AUDIT.md](docs/AUDIT.md).

## Layout

```
contracts/          Monocle.py (engine + in-process MonocleVault ledger), MonocleFactory.py, MonocleReputation.py
tests/direct/       212 gltest direct-mode tests + glsim multi-contract system tests
tests/integration/  real-node lifecycle (skips cleanly without a node)
deploy/             001_deploy_monocle_system.ts, networks.ts (Studio Next default)
sdk/typescript/     @monocle/sdk: clients, strict finality, typed calls
sdk/python/         monocle_sdk
frontend/           Next.js web app: explore, create, submit/back, adjudicate, challenge, finalize, claim
docs/               ARCHITECTURE, RESOLUTION_LOGIC, AGENT_SDK, AUDIT, STUDIO_NEXT, LIMITATIONS
```

**Vault design.** On v0.6, a write to another contract is an asynchronous message, so a separate
vault contract cannot debit a balance synchronously inside `claim()`. Custody is therefore an
isolated `MonocleVault` ledger inside each Monocle. It has its own conservation invariants, and
11 tests cover them. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#vault-decision).

## Test

Install Python 3.12 dependencies (the locked v0.6 RC family):

```bash
pip install .
```

Lint each contract:

```bash
genvm-lint check contracts/Monocle.py
```

```bash
genvm-lint check contracts/MonocleFactory.py
```

```bash
genvm-lint check contracts/MonocleReputation.py
```

Run the direct-mode suite (212 tests, about 30 s; `GENVM_VERSION=v0.6.0-rc5` is pinned):

```bash
gltest tests/direct -v
```

Run the integration suite. It needs a funded account and skips if no RPC is reachable. Set
`MONOCLE_INTEGRATION_LONG=1` to wait out the challenge window.

```bash
gltest tests/integration -v --network studio_devnet
```

SDKs:

```bash
npm install
```

```bash
npm run typecheck
```

```bash
npm run test:sdk
```

```bash
pip install ./sdk/python
```

```bash
pytest sdk/python/tests -p no:gltest
```

CI (`.github/workflows/ci.yml`) runs genvm-lint and gltest direct, plus the TypeScript typecheck and
SDK tests, on every push and pull request to `main`. It needs no live Studio node.

## Deploy to Studio Next

```bash
cp .env.example .env
```

Set `PRIVATE_KEY` (fund it from the Studio faucet), or `KEYSTORE_PATH` + `KEYSTORE_PASSWORD`.
Optionally set `CREATION_STAKE_WEI`, the `MIN_*_BOND_WEI` values and `CHALLENGE_WINDOW_SECONDS`
(default 3600; the public demo uses 180). Then:

```bash
npm run deploy:studio-next
```

Seed a demo market and run its whole lifecycle (create, submit ×2, adjudicate, wait out the window,
finalize, settle, claim), recording every transaction hash in `deploy/deployments.json`:

```bash
npm run seed:studio-next
```

The script deploys `MonocleFactory` with `Monocle.py` and `MonocleReputation.py` embedded. The
factory's constructor deploys the reputation aggregator. Fees come from the SDK's v0.6 estimator,
and the script waits for FINALIZED with `FINISHED_WITH_RETURN`. It records the result in
`deploy/deployments.json` and re-runs cleanly after a Studio Next reset. See
[docs/STUDIO_NEXT.md](docs/STUDIO_NEXT.md).

| | |
| --- | --- |
| Network | GenLayer Studio Next (browser: https://studio-next.genlayer.com) |
| RPC | https://studio-dev.genlayer.com/api |
| Chain ID | 61997 |
| Explorer | https://explorer-studio-dev.genlayer.com |
| Local | localnet, 61127 |

## Web app

`frontend/` is a Next.js app built on `@monocle/sdk`, so every write uses the same fee estimation
and strict FINALIZED + `FINISHED_WITH_RETURN` checks as agents do. It connects any EVM browser
wallet to Studio Next (it adds the network if needed).

```bash
npm run dev:web
```

Factory resolution, highest first:

1. a per-browser override pasted on Explore/Create (localStorage `monocle.factory`);
2. `NEXT_PUBLIC_MONOCLE_FACTORY` at build time (Vercel project env);
3. `frontend/lib/deployment.ts`, generated from `deploy/deployments.json` by the deploy and seed
   scripts (`npm run sync:frontend` regenerates it by hand).

A cold browser therefore always gets the recorded deployment, with no env var needed. Every page
shows a health line (RPC, chain, wallet network, factory code, Monocle count, last error) and never
presents a failed read as "no markets yet".

Hosting on Vercel: project root directory `frontend`, install command `cd .. && npm install`
(so the SDK workspace resolves), build command `npm run build`. The site is built from the
committed `deployment.ts`, so **rebuild after every redeploy** (`vercel deploy --prod`), and if you
set `NEXT_PUBLIC_MONOCLE_FACTORY`, update it to the new factory first.

### After a Studio Next reset

```bash
npm run check:studio-next
```

If it reports the factory has no code:

```bash
CHALLENGE_WINDOW_SECONDS=180 npm run deploy:studio-next
```

```bash
npm run seed:studio-next
```

Then commit `deploy/deployments.json` and `frontend/lib/deployment.ts`, update
`NEXT_PUBLIC_MONOCLE_FACTORY` on Vercel if it is set, and redeploy the site.

## Honest limits

Deciding which interpretation fits the fetched text is still, ultimately, a language model's
judgment. MONOCLE narrows that judgment and makes it auditable. It does not make it mechanical.
Read [docs/LIMITATIONS.md](docs/LIMITATIONS.md) before letting an agent move money on an output.

## License

MIT
