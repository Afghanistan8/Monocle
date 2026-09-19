"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { FactoryCalls, STUDIO_NEXT_CHAIN_ID, STUDIO_NEXT_RPC, type Address } from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import {
  DEPLOY_COMMAND,
  STUDIO_URL,
  explorerAddress,
  resolveFactory,
  setFactoryAddress,
  type FactorySource,
} from "@/lib/config";
import { errorText, short } from "@/lib/format";
import { FactorySetup } from "./Bits";

export interface Health {
  loading: boolean;
  rpcOk: boolean | null;
  rpcChainId: number | null;
  factory: Address | null;
  source: FactorySource;
  factoryHasCode: boolean | null;
  monocleCount: number | null;
  error: string | null;
  /** True only when every read succeeded and the factory is alive. */
  healthy: boolean;
  refresh: () => void;
  setFactory: (value: string) => void;
}

const HealthContext = createContext<Health | null>(null);

async function rpcChainId(): Promise<number> {
  const res = await fetch(STUDIO_NEXT_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (!body.result) throw new Error(body.error?.message ?? `RPC HTTP ${res.status}`);
  return Number.parseInt(body.result, 16);
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const { reader } = useWallet();
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<Health, "refresh" | "setFactory" | "healthy">>({
    loading: true,
    rpcOk: null,
    rpcChainId: null,
    factory: null,
    source: "none",
    factoryHasCode: null,
    monocleCount: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { factory, source } = resolveFactory();
      const next: typeof state = {
        loading: false,
        rpcOk: null,
        rpcChainId: null,
        factory,
        source,
        factoryHasCode: null,
        monocleCount: null,
        error: null,
      };
      try {
        next.rpcChainId = await rpcChainId();
        next.rpcOk = true;
      } catch (err) {
        next.rpcOk = false;
        next.error = `RPC unreachable: ${errorText(err)}`;
      }
      if (factory && next.rpcOk) {
        try {
          const code = await reader.getContractCode(factory);
          next.factoryHasCode = typeof code === "string" && code.length > 0;
        } catch (err) {
          next.factoryHasCode = false;
          next.error = `Factory has no code on Studio Next (reset?): ${errorText(err)}`;
        }
        if (next.factoryHasCode) {
          try {
            next.monocleCount = await new FactoryCalls(reader, factory).getMonoclesCount();
          } catch (err) {
            next.error = `Factory read failed: ${errorText(err)}`;
          }
        }
      }
      if (!cancelled) setState(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reader, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const setFactory = useCallback(
    (value: string) => {
      setFactoryAddress(value);
      refresh();
    },
    [refresh],
  );
  const healthy = Boolean(
    state.rpcOk && state.rpcChainId === STUDIO_NEXT_CHAIN_ID && state.factoryHasCode && state.monocleCount !== null && !state.error,
  );

  return <HealthContext.Provider value={{ ...state, healthy, refresh, setFactory }}>{children}</HealthContext.Provider>;
}

export function useHealth(): Health {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used inside HealthProvider");
  return ctx;
}

function Item({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  const tone = ok === null ? "" : ok ? "ok" : "bad";
  return (
    <span className="health-item">
      <span className={`hdot ${tone}`} aria-hidden />
      {children}
    </span>
  );
}

/** Compact one-line status used on Home, Explore and Create. */
export function HealthBar({ showSetup = true }: { showSetup?: boolean }) {
  const h = useHealth();
  const { address, walletChainId, wrongNetwork, switchNetwork, hasWallet } = useWallet();

  if (h.loading) {
    return (
      <div className="health" role="status">
        <Item ok={null}>Checking Studio Next…</Item>
      </div>
    );
  }

  const factoryDead = !h.factory || h.factoryHasCode === false;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="health" role="status" aria-live="polite">
        <Item ok={h.rpcOk}>{h.rpcOk ? "RPC ok" : "RPC down"}</Item>
        <Item ok={h.rpcChainId === STUDIO_NEXT_CHAIN_ID}>chain {h.rpcChainId ?? "?"}</Item>
        <Item ok={address ? !wrongNetwork : null}>
          {!hasWallet
            ? "no wallet"
            : !address
              ? "wallet not connected"
              : wrongNetwork
                ? `wallet on ${walletChainId} (wrong network)`
                : `wallet on ${STUDIO_NEXT_CHAIN_ID}`}
          {address && wrongNetwork && (
            <button className="linkish" onClick={() => void switchNetwork()}>
              switch
            </button>
          )}
        </Item>
        <Item ok={h.factory ? h.factoryHasCode : false}>
          {h.factory ? (
            <>
              factory{" "}
              <a href={explorerAddress(h.factory)} target="_blank" rel="noreferrer">
                {short(h.factory)} ↗
              </a>{" "}
              · {h.factoryHasCode ? "code ok" : h.factoryHasCode === false ? "no code" : "?"}
              <span className="faint"> ({h.source})</span>
            </>
          ) : (
            "no factory"
          )}
        </Item>
        <Item ok={h.monocleCount !== null}>
          {h.monocleCount !== null ? `${h.monocleCount} Monocle${h.monocleCount === 1 ? "" : "s"}` : "count unavailable"}
        </Item>
        <button className="linkish" onClick={h.refresh}>
          recheck
        </button>
      </div>
      {h.error && <div className="notice error small">{h.error}</div>}
      {showSetup && factoryDead && h.rpcOk !== false && (
        <div className="stack">
          <FactorySetup current={h.factory} onSave={h.setFactory} />
          <div className="notice small">
            Operator: redeploy with <code>{DEPLOY_COMMAND}</code>, then rebuild the site. Studio Next state can reset.
          </div>
        </div>
      )}
      {!address && (
        <div className="hint">
          {!hasWallet && "To transact you need MetaMask or any EIP-1193 browser wallet. "}
          Need test GEN? Open{" "}
          <a href={STUDIO_URL} target="_blank" rel="noreferrer">
            studio-next.genlayer.com ↗
          </a>
          , use the built-in faucet for your wallet address, then come back.
        </div>
      )}
    </div>
  );
}
