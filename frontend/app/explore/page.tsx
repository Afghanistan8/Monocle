"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FactoryCalls, MonocleCalls, type Address, type MonocleInfo } from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import { errorText, formatGen, short } from "@/lib/format";
import { formatWindow } from "@/lib/config";
import { Skeleton, StatusBadge, useFactory } from "@/components/Bits";
import { HealthBar } from "@/components/Health";
import { SeededMarketCard } from "@/components/LiveStats";

const PAGE = 12;

type Row = { address: Address; info: MonocleInfo | null; error?: string };

export default function ExplorePage() {
  const { reader } = useWallet();
  const { factory, health } = useFactory();
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0); // 0 = newest
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!factory || health.factoryHasCode === false) return;
    setLoading(true);
    setReadError(null);
    try {
      const f = new FactoryCalls(reader, factory);
      const count = await f.getMonoclesCount();
      setTotal(count);
      const end = Math.max(0, count - page * PAGE);
      const start = Math.max(0, end - PAGE);
      const slice = end > start ? await f.getMonoclesPage(start, end - start) : { addresses: [] };
      const addresses = [...(slice.addresses ?? [])].reverse() as Address[];
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
      setRows([]);
      setReadError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [factory, reader, page, health.factoryHasCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE));
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
            placeholder="Search this page"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link href="/create" className="btn primary small">
            Open a Monocle
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <HealthBar />
      </div>

      {readError && (
        <div className="stack" style={{ marginBottom: 16 }}>
          <div className="notice error">
            Could not read the Monocle list from factory {factory ? short(factory) : "?"}: {readError}. This is a read
            failure, not an empty market list.
          </div>
          <div className="grid">
            <SeededMarketCard />
          </div>
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="card" key={i}>
              <Skeleton />
            </div>
          ))}
        </div>
      )}

      {!loading && !readError && total === 0 && (
        <div className="notice">This factory has no Monocles yet. Open the first one.</div>
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
                Round {info.current_round} · {info.sources.length} sources · window {formatWindow(info.challenge_window_seconds)}
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

      {total !== null && total > PAGE && (
        <div className="row" style={{ marginTop: 18, justifyContent: "center" }}>
          <button className="btn small" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
            ← Newer
          </button>
          <span className="small muted">
            Page {page + 1} of {pages} · {total} total
          </span>
          <button className="btn small" disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
