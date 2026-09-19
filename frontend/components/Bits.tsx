"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GITHUB_URL, getFactoryAddress, isAddress, setFactoryAddress } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import type { TxPhase } from "@/lib/useTx";

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

export function WalletGate({ children, action = "transact" }: { children: ReactNode; action?: string }) {
  const { address, connect, connecting, error, hasWallet } = useWallet();
  if (address) return <>{children}</>;
  return (
    <div className="stack">
      <div className="notice">
        Connect a wallet on GenLayer Studio Next to {action}.
        {!hasWallet && " No browser wallet was detected."}
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="btn primary" onClick={connect} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}

/** Resolves the factory address; lets the visitor set one if none is configured. */
export function useFactory() {
  const [factory, setFactory] = useState<`0x${string}` | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFactory(getFactoryAddress());
    setReady(true);
  }, []);
  const update = (value: string) => {
    setFactoryAddress(value);
    setFactory(getFactoryAddress());
  };
  return { factory, ready, update };
}

export function FactorySetup({ onSave, current }: { onSave: (v: string) => void; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const valid = isAddress(value);
  return (
    <div className="card stack">
      <div className="label">MonocleFactory address</div>
      <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
        No factory is configured for this site yet. Deploy the system with <code>npm run deploy:studio-next</code>{" "}
        and paste the factory address here, or set <code>NEXT_PUBLIC_MONOCLE_FACTORY</code> on the host. Studio Next can
        reset, so this is stored per browser.
      </p>
      <input className="input" placeholder="0x…" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
      <div className="row">
        <button className="btn small primary" disabled={!valid} onClick={() => onSave(value)}>
          Use this factory
        </button>
        {current && (
          <button className="btn small" onClick={() => onSave("")}>
            Reset to default
          </button>
        )}
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
