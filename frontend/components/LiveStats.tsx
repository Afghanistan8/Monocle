"use client";

import { useEffect, useState } from "react";
import { FactoryCalls } from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import { useFactory } from "./Bits";

export default function LiveStats() {
  const { reader } = useWallet();
  const { factory, ready } = useFactory();
  const [count, setCount] = useState<string>("—");

  useEffect(() => {
    if (!ready || !factory) return;
    let cancelled = false;
    new FactoryCalls(reader, factory)
      .getMonoclesCount()
      .then((n) => !cancelled && setCount(String(n)))
      .catch(() => !cancelled && setCount("—"));
    return () => {
      cancelled = true;
    };
  }, [reader, factory, ready]);

  return (
    <div className="stats">
      <div className="stat">
        <div className="v">{factory ? count : "—"}</div>
        <div className="k">Monocles opened</div>
      </div>
      <div className="stat">
        <div className="v">61997</div>
        <div className="k">Studio Next chain</div>
      </div>
      <div className="stat">
        <div className="v">1h</div>
        <div className="k">Challenge window</div>
      </div>
      <div className="stat">
        <div className="v">≥2</div>
        <div className="k">Corroborating sources</div>
      </div>
    </div>
  );
}
