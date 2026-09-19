"use client";

import { useState, type ReactNode } from "react";
import { DEPLOY_COMMAND, GITHUB_URL, STUDIO_URL, isAddress } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import type { TxPhase } from "@/lib/useTx";
import { useHealth } from "./Health";

export function Footer() {
  return (
    <footer className="container footer">
      <span>MONOCLE · interpretation engine on GenLayer Studio Next · chain 61997</span>
      <span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          Source ↗
        </a>
      </span>
    </footer>
  );
}

export function TxNotice({ phase, message }: { phase: TxPhase; message: string | null }) {
  if (!message) return null;
  const tone = phase === "error" ? "error" : phase === "success" ? "success" : "info";
  return (
    <div className={`notice ${tone}`} role="status">
      <span className="row">
        {phase === "pending" && <span className="spinner" aria-hidden />}
        <span>{message}</span>
      </span>
    </div>
  );
}

export function FinalityBadge({ finality }: { finality: string }) {
  const map: Record<string, string> = { final: "final", pending: "pending", refund: "bad", none: "" };
  return <span className={`badge ${map[finality] ?? ""}`}>{finality || "none"}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "finalized" || status === "settled"
      ? "final"
      : status === "decided_pending" || status === "challenged" || status === "resolving" || status === "adjudicating"
        ? "pending"
        : status === "open"
          ? "accent"
          : status === "inconclusive" || status === "cancelled" || status === "closed"
            ? "bad"
            : "";
  return <span className={`badge ${tone}`}>{status.replace("_", " ") || "unknown"}</span>;
}

export function FaucetHint() {
  return (
    <span className="hint">
      Need test GEN? Open{" "}
      <a href={STUDIO_URL} target="_blank" rel="noreferrer" style={{ color: "var(--text)" }}>
        studio-next.genlayer.com ↗
      </a>
      , use the built-in faucet for your address, then come back.
    </span>
  );
}

export function WalletGate({ children, action = "transact" }: { children: ReactNode; action?: string }) {
  const { address, connect, connecting, error, hasWallet, wrongNetwork, walletChainId, switchNetwork } = useWallet();
  if (address && !wrongNetwork) return <>{children}</>;
  if (address && wrongNetwork) {
    return (
      <div className="stack">
        <div className="notice error">
          Your wallet is on chain {walletChainId}. Switch to GenLayer Studio Next (61997) to {action}.
        </div>
        {error && <div className="notice error">{error}</div>}
        <button className="btn primary" onClick={() => void switchNetwork()}>
          Switch to Studio Next
        </button>
      </div>
    );
  }
  if (!hasWallet) {
    return <div className="hint">Browser wallet required to {action} (MetaMask or any EIP-1193 wallet).</div>;
  }
  return (
    <div className="stack">
      <div className="notice">
        Connect a wallet on GenLayer Studio Next to {action}. You will be asked to add the network if it is missing.
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="btn primary" onClick={() => void connect()} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      <FaucetHint />
    </div>
  );
}

/** Current factory from the shared health check (browser > env > deployment). */
export function useFactory() {
  const h = useHealth();
  return { factory: h.factory, ready: !h.loading, update: h.setFactory, health: h };
}

export function FactorySetup({ onSave, current }: { onSave: (v: string) => void; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const valid = isAddress(value);
  return (
    <div className="card stack">
      <div className="label">MonocleFactory address</div>
      <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
        {current
          ? "The configured factory is not answering on Studio Next (the network may have been reset)."
          : "No factory is configured for this site."}{" "}
        Paste a live factory address to use it in this browser, or redeploy with <code>{DEPLOY_COMMAND}</code> and rebuild
        the site.
      </p>
      <input className="input" placeholder="0x…" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
      <div className="row">
        <button className="btn small primary" disabled={!valid} onClick={() => onSave(value)}>
          Use this factory
        </button>
        <button className="btn small" onClick={() => onSave("")}>
          Reset to site default
        </button>
      </div>
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
