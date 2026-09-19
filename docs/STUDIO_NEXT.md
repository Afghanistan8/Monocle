# Studio Next (Consensus v0.6 RC)

MONOCLE's default target is **GenLayer Studio Next**, the Studio development preview running the
Consensus v0.6 release candidate.

## Network

| Property | Value |
| --- | --- |
| Network label | GenLayer Studio Next |
| Browser alias (humans) | https://studio-next.genlayer.com |
| **Canonical programmatic RPC** | **https://studio-dev.genlayer.com/api** |
| Chain ID | **61997** |
| Currency | GEN |
| Explorer | https://explorer-studio-dev.genlayer.com |
| CLI alias | `studio-dev` |
| genlayer-js 2.0 RC chain | `studioDevnet` (MONOCLE relabels it `studioNext`; same id and RPC) |
| genlayer-py 0.19 RC chain | `studio_devnet` |
| gltest network name | `studio_devnet` |
| Faucet | built into Studio (fund the account from the Studio UI or the CLI) |

`studio-next.genlayer.com` is a browser alias. Clients use the canonical `studio-dev` RPC. Both
RC SDKs ship exactly this preset (`studioDevnet`, `studio_devnet`: chain 61997,
`https://studio-dev.genlayer.com/api`), so there is only one chain. **Do not** use the Studionet
preset (61999) and **do not** default to Bradbury.

Local development uses **localnet** (chain 61127, `http://localhost:4000/api`), through GenLayer
Studio or GLSim.

## Locked release family

Never mix these with stable Studionet tooling.

| Component | Version | Where pinned |
| --- | --- | --- |
| Consensus contracts and node | v0.6 RC | (network) |
| GenLayer Studio | v0.123 RC | (network) |
| genlayer-js | `2.0.0-rc.1` | `package.json`, `sdk/typescript/package.json` |
| genlayer-py | `0.19.0rc2` | `pyproject.toml`, `sdk/python/pyproject.toml` |
| genlayer-test (gltest) | `0.30.0rc2` | `pyproject.toml` |
| genvm-linter | `0.11.1rc2` | `pyproject.toml` |
| GenLayer CLI | `0.40.0-rc.3` (npm dist-tag `rc`) | install with `npm i -g genlayer@rc` |
| GenVM runtime used by gltest | `v0.6.0-rc5` | `GENVM_VERSION` (tests/direct/conftest.py) |

### Runner pin

All contracts declare:

```python
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
```

This is the runner that `genvm-linter 0.11.1rc2` reports as current for GenVM v0.6.0-rc5.
Older runners (for example `1jb45aa8…`) still validate, but the linter flags them as outdated.

The v0.6 SDK behind this runner **is not source-compatible with older GenLayer contracts**:

| Older runner | v0.6 runner (MONOCLE) |
| --- | --- |
| `from genlayer import *` + `import genlayer.gl as gl` | `import genlayer as gl` (the `genlayer.gl` submodule no longer exists) |
| `class MyContract(gl.Contract)` | `class Monocle(gl.contract.Contract)` |
| `gl.vm.run_nondet_unsafe(leader, validator)` | `gl.vm.run_nondet(leader, validator)` (`run_nondet_default` is the sandboxed variant) |
| `gl.message_raw["datetime"]` | `gl.message.raw["datetime"]` |
| `gl.deploy_contract(code=…, args=…, salt_nonce=…)` | `gl.contract.deploy(code=…, args=…, salt_nonce=u256(…))` (returns the CREATE2 address) |
| `@gl.evm.contract_interface class _Recipient` + `.emit_transfer` | `gl.contract.get_at(addr).emit_transfer(value=…)` |
| `TreeMap`, `DynArray`, `u256`, `Address` from `genlayer` | `from genlayer.storage import TreeMap, DynArray`; `from genlayer.types import Address, u256` |

Other RC findings recorded while building MONOCLE:

* `__receive__` cannot be used. `genvm-lint` requires it to carry `@gl.public.write`, while the
  SDK schema validator rejects public methods whose names start with `__`. The factory therefore
  exposes an explicit payable `receive_residual()`.
* `genvm-lint`'s reachability analysis does not resolve calls between **sibling** nested
  functions (`leader_fn` calling a sibling `evaluate`). The re-derivation logic lives *in*
  `leader_fn(force_judge=False)`, and the validator calls `leader_fn(True)`.
* **gltest direct mode, specific to this RC:**
  * `vm.warp()` does not update `gl.message.raw["datetime"]` (patched in conftest).
  * Storage is not rolled back on a raised error (`run_tx` emulates atomicity).
  * Value transfers and messages are not executed (conftest records them).
  * Every deploy queries the GitHub releases API unless `GENVM_VERSION` is set. The API
    rate-limits, which made one run take 7.5 minutes.
  * Windows only: the loader unlinks a still-open temp stdin file (patched in conftest).
* **glsim 0.30.0rc2** reads `calldata["method"]`, but the v0.6 SDK encodes the method under
  `""`. Unpatched, every cross-contract view fails and every message is dropped.
  `tests/direct/glsim_harness.py` shims this.
* **Unset `${VAR}` in `gltest.config.yaml`** fail *every* run, direct tests included, because
  gltest resolves all networks at load time. The config therefore uses presets only.

## Fees (v0.6)

* Every deploy and write carries a quoted `FeesDistribution` and `feeValue`. Unused budget is
  refunded at finalization.
* MONOCLE never hand-rolls fee arithmetic:
  * writes use `client.estimateTransactionFeesForWrite({address, functionName, args, value})`
    (Python: `estimate_transaction_fees_for_write`). It simulates the exact call, including
    **internal-message allocations**, which MONOCLE needs because `claim`,
    `claim_source_bond`, `flush_residual`, `withdraw_fees` and `create_monocle` all emit
    messages;
  * the factory deploy uses `client.estimateTransactionFees()`.
* If a factory deploy is under-budgeted for its internal `MonocleReputation` deploy message, the
  factory still deploys. The deploy script checks for code at the reputation address and warns.

## consensusMaxRotations

`adjudicate` and `resolve_challenge` are submitted with `consensusMaxRotations = 6`. The Studio
presets default to 3. Why raise it:

1. Each validator re-fetches up to 8 live pages, and a single flaky fetch changes its verdict.
2. The validator deliberately disagrees on `LLM_MALFORMED`, and rotation is the recovery path.
3. Claim-level verdicts carry more fields that must agree (winner, confidence, composite).

Six gives room for recovery without letting a
genuinely contested round burn fees indefinitely.

## Finality

* Wait for **FINALIZED** on `create_monocle`, `adjudicate`, `resolve_challenge`, `finalize`,
  `settle` and `claim`. The SDKs do this by default.
* ACCEPTED can still be appealed. `FINISHED_WITH_ERROR` is a failure even when ACCEPTED or
  FINALIZED.

## Resets

Studio Next is a release-candidate environment, and **its state and availability are not
guaranteed**. Contracts, balances and history can disappear on a reset. The deploy script records
`{factory, reputation, sourcesHash}` per network in `deploy/deployments.json`. On re-run:

* if the recorded factory still has code and the sources are unchanged, it does nothing;
* if the code is gone (a reset) or the sources changed, it deploys a fresh system and replaces
  the record.

`FORCE_REDEPLOY=1` always deploys. Agents should resolve the factory address from their own
config or `deployments.json`, never hard-code it.

## Public app runbook

The public site (https://monocle-ten.vercel.app) reads Studio Next directly from the browser. Every
page shows a health line: RPC, chain id, wallet network, factory address and code, Monocle count,
last error. Use it, plus `npm run check:studio-next`, to diagnose.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Health line: "RPC down" | `studio-dev.genlayer.com` unreachable or down | Wait; nothing to fix in the app. Reads and writes both need the RPC |
| "factory … no code" or `check:studio-next` reports code MISSING | Studio Next was reset, or the site points at an old factory | `CHALLENGE_WINDOW_SECONDS=180 npm run deploy:studio-next`, then `npm run seed:studio-next`, commit `deploy/deployments.json` + `frontend/lib/deployment.ts`, update `NEXT_PUBLIC_MONOCLE_FACTORY` on Vercel if set, `vercel deploy --prod` |
| Right factory in `deployments.json`, but the site shows the old one | Site not rebuilt, a stale `NEXT_PUBLIC_MONOCLE_FACTORY`, or a stale per-browser override | Rebuild; fix the env var; click "Reset to site default" in the factory box |
| Create shows "unavailable" for the creation stake | `get_creation_stake` failed (RPC or dead factory) | Same as the two rows above. A numeric stake (e.g. "0 GEN") means the read worked |
| Explore shows a red "Could not read the Monocle list" | Factory read threw. This is not an empty list | Check the health line; the seeded market card is shown as a fallback |
| Wallet badge: "Wrong network" | Wallet not on 61997 | Click it (or "Switch to Studio Next"); the app adds the network if the wallet lacks it |
| "No browser wallet" | No injected EIP-1193 provider | Install MetaMask or any EIP-1193 wallet |
| Write fails with "…FINISHED_WITH_ERROR" | The contract reverted (for example bond too low, round not open, window still open) | Read the reason shown. It is never shown as success |
| Adjudicate spins for minutes | Every validator re-fetches every source and re-runs the LLM; leaders may rotate (up to 6) | Wait. The result is then stated explicitly: decided (pending), inconclusive (refunds), or unchanged (refunds) |
| Wallet has no GEN | New account | Open https://studio-next.genlayer.com, use the built-in faucet for the address, come back |
| Reputation address has no code right after a deploy | Its deploy is an internal message that runs after the factory finalizes | The deploy script polls for up to 2 minutes; otherwise rerun `npm run check:studio-next` shortly |

Two Studio Next facts that affect tooling:

* Studio Next's simulation endpoints (`sim_call`, `sim_estimateTransactionFees`) can run at a
  stale timestamp. Time-gated writes such as `finalize()` then fail in simulation ("execution
  failed") while succeeding on chain. The SDK's `estimateFees` falls back to the generic v0.6
  estimate when the per-call simulation fails; a real revert still comes back as
  `FINISHED_WITH_ERROR` and is rejected. Verified live: the seeded market's finalize failed eight
  simulations after its deadline, then finalized on the first real send.
* `eth_getCode` returns empty for GenLayer contracts. Use `client.getContractCode(address)`
  (`gen_getContractCode`) to check whether a contract exists.
* The demo deployment uses a **180-second** challenge window, set per factory by
  `CHALLENGE_WINDOW_SECONDS` at deploy time and passed to every Monocle it creates. Existing
  Monocles keep the window they were created with. Production deployments should use 3600.

## Quick start

```bash
npm install
cp .env.example .env   # set PRIVATE_KEY (funded on Studio Next via the Studio faucet)
```

```bash
npm run deploy:studio-next
```

```bash
gltest tests/integration -v --network studio_devnet
```
