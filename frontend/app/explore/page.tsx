"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FactoryCalls, MonocleCalls, type Address, type MonocleInfo } from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import { errorText, formatGen, short } from "@/lib/format";
import { FactorySetup, Skeleton, StatusBadge, useFactory } from "@/components/Bits";

const PAGE = 12;

type Row = { address: Address; info: MonocleInfo | null; error?: string };

export default function ExplorePage() {
  const { reader } = useWallet();
  const { factory, ready, update } = useFactory();
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const load = useCallback(async () => {
    if (!factory) return;
    setLoading(true);
    setError(null);
    try {
      const f = new FactoryCalls(reader, factory);
      const count = await f.getMonoclesCount();
      setTotal(count);
      const offset = Math.max(0, count - PAGE);
      const page = await f.getMonoclesPage(offset, PAGE);
      const addresses = [...(page.addresses ?? [])].reverse() as Address[];
      const infos = await Promise.all(
        addresses.map(async (address) => {
          try {
            return { address, info: await new MonocleCalls(reader, address).getInfo() };
          } catch (err) {
            return { address, info: null, error: errorText(err) };
          }
        }),
      );
      setRows(infos);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [factory, reader]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.address.toLowerCase().includes(q) ||
        r.info?.title.toLowerCase().includes(q) ||
        r.info?.interpretation_type.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Explore</div>
          <h1>Live Monocles</h1>
        </div>
        <div className="row">
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Search title, type, address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link href="/create" className="btn primary small">
            Open a Monocle
          </Link>
        </div>
      </div>

      {ready && (!factory || showSetup) && (
        <div style={{ marginBottom: 16 }}>
          <FactorySetup
            current={factory}
            onSave={(v) => {
              update(v);
              setShowSetup(false);
            }}
          />
        </div>
      )}

      {factory && (
        <div className="row small muted" style={{ marginBottom: 16 }}>
          <span>
            Factory {short(factory)} · {total ?? "…"} Monocles
          </span>
          <button className="btn small" onClick={() => setShowSetup((v) => !v)}>
            Change
          </button>
          <button className="btn small" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      )}

      {error && <div className="notice error">Could not read the factory: {error}</div>}

      {loading && rows.length === 0 && (
        <div className="grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="card" key={i}>
              <Skeleton />
            </div>
          ))}
        </div>
      )}

      {!loading && factory && !error && rows.length === 0 && (
        <div className="notice">No Monocles yet. Open the first one.</div>
      )}

      <div className="grid">
        {filtered.map(({ address, info, error: rowError }) => (
          <Link key={address} href={`/m/${address}`} className="card stack">
            <div className="row between">
              <span className="badge accent">{info?.interpretation_type ?? "monocle"}</span>
              {info && <StatusBadge status={info.status === "active" ? info.current_round_status : info.status} />}
            </div>
            <h3>{info?.title ?? short(address)}</h3>
            {info ? (
              <div className="meta">
                Round {info.current_round} · {info.sources.length} sources
                <br />
                {info.live_interpretation_id ? "Final output published" : "No final output yet"}
                <br />
                Staked all-time {formatGen(info.total_stake_all_time)}
              </div>
            ) : (
              <div className="meta">Unreadable: {rowError}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
