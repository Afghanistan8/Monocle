"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FactoryCalls } from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import { useTx } from "@/lib/useTx";
import { formatGen } from "@/lib/format";
import { FactorySetup, TxNotice, WalletGate, useFactory } from "@/components/Bits";

function parseSchema(text: string): Record<string, string> | undefined {
  const entries = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim() || "value"] as const;
    })
    .filter(([key]) => key);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export default function CreatePage() {
  const router = useRouter();
  const { reader, writer } = useWallet();
  const { factory, ready, update } = useFactory();
  const tx = useTx();
  const [stake, setStake] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "market",
    description: "",
    sources: "",
    schema: "",
  });

  useEffect(() => {
    if (!factory) return;
    new FactoryCalls(reader, factory)
      .getCreationStake()
      .then(setStake)
      .catch(() => setStake(null));
  }, [factory, reader]);

  const sources = form.sources
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const sourcesOk = sources.length >= 2 && sources.length <= 8 && sources.every((s) => /^https?:\/\//i.test(s));
  const canSubmit = Boolean(factory && writer && form.title.trim() && form.type.trim() && sourcesOk && !tx.busy);

  const submit = async () => {
    if (!factory || !writer) return;
    await tx.run(
      "Create Monocle",
      () =>
        new FactoryCalls(writer, factory).createMonocle({
          sources,
          interpretationType: form.type.trim(),
          title: form.title.trim(),
          description: form.description.trim(),
          schema: parseSchema(form.schema),
          value: stake ? BigInt(stake) : undefined,
        }),
      (result) => router.push(`/m/${result.monocle}`),
    );
  };

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Create</div>
          <h1>Open a Monocle</h1>
        </div>
      </div>

      {ready && !factory && <FactorySetup current={null} onSave={update} />}

      <div className="two-col">
        <div className="card">
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" className="input" maxLength={140} value={form.title} onChange={set("title")} placeholder="Is BTC dominance rising this week?" />
          </div>
          <div className="field">
            <label htmlFor="type">Interpretation type</label>
            <input id="type" className="input" maxLength={40} value={form.type} onChange={set("type")} placeholder="market · filing · research · refutation" />
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea id="desc" className="textarea" maxLength={1000} value={form.description} onChange={set("description")} placeholder="What should interpretations explain?" />
          </div>
          <div className="field">
            <label htmlFor="sources">Sources · one URL per line · 2 to 8</label>
            <textarea id="sources" className="textarea" value={form.sources} onChange={set("sources")} placeholder={"https://example.com/live-feed\nhttps://example.org/report"} />
            <span className="hint">
              {sources.length} source{sources.length === 1 ? "" : "s"}
              {!sourcesOk && sources.length > 0 && " · need 2–8 http(s) URLs"}. Anyone can add more later with a bond;
              none can ever be removed.
            </span>
          </div>
          <div className="field">
            <label htmlFor="schema">Required fields (optional) · one per line, name=description</label>
            <textarea id="schema" className="textarea" value={form.schema} onChange={set("schema")} placeholder={"direction=up|down|flat\nmagnitude=percent change"} />
          </div>
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="label">Creation stake</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{stake === null ? "—" : formatGen(stake)}</div>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
              Charged once by the factory. Anything you send above it is refunded in the same transaction.
            </p>
          </div>
          <div className="card stack">
            <WalletGate action="open a Monocle">
              <button className="btn primary" disabled={!canSubmit} onClick={submit}>
                {tx.busy ? "Creating…" : "Create Monocle"}
              </button>
              <TxNotice phase={tx.phase} message={tx.message} />
            </WalletGate>
          </div>
        </div>
      </div>
    </div>
  );
}
