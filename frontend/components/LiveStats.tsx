"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MonocleCalls, type MonocleInfo } from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import { DEPLOYMENT, formatWindow } from "@/lib/config";
import { useHealth } from "./Health";
import { StatusBadge } from "./Bits";

export default function LiveStats() {
  const h = useHealth();
  return (
    <div className="stats">
      <div className="stat">
        <div className="v">{h.monocleCount ?? "—"}</div>
        <div className="k">Monocles opened</div>
      </div>
      <div className="stat">
        <div className="v">61997</div>
        <div className="k">Chain ID</div>
      </div>
      <div className="stat">
        <div className="v">{formatWindow(DEPLOYMENT.challengeWindowSeconds)}</div>
        <div className="k">Challenge window{DEPLOYMENT.challengeWindowSeconds < 3600 ? " (demo)" : ""}</div>
      </div>
      <div className="stat">
        <div className="v">≥2</div>
        <div className="k">Corroborating sources</div>
      </div>
    </div>
  );
}

/** Card for the market seeded by deploy/002_open_test_market.ts. */
export function SeededMarketCard() {
  const { reader } = useWallet();
  const seeded = DEPLOYMENT.seeded;
  const [info, setInfo] = useState<MonocleInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!seeded) return;
    new MonocleCalls(reader, seeded.address)
      .getInfo()
      .then(setInfo)
      .catch(() => setFailed(true));
  }, [reader, seeded]);

  if (!seeded) return null;
  return (
    <Link href={`/m/${seeded.address}`} className="card stack" style={{ textAlign: "left" }}>
      <div className="row between">
        <span className="badge accent">seeded demo market</span>
        {info && <StatusBadge status={info.current_round_status} />}
      </div>
      <h3>{info?.title ?? "Seeded market"}</h3>
      <div className="meta">
        {failed
          ? "Not readable right now (Studio Next may have reset)."
          : info
            ? `Round ${info.current_round} · ${info.live_interpretation_id ? "final output published" : "no final output yet"} · window ${formatWindow(info.challenge_window_seconds)}`
            : "Loading…"}
      </div>
      <span className="small" style={{ color: "var(--accent)" }}>
        Open and try it →
      </span>
    </Link>
  );
}
