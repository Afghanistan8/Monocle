"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MonocleCalls,
  type Address,
  type AdjudicationRecord,
  type Interpretation,
  type LiveInterpretation,
  type MonocleInfo,
  type RoundInfo,
  type SourceRecord,
} from "@monocle/sdk";
import { useWallet } from "@/lib/wallet";
import { useTx } from "@/lib/useTx";
import { formatWindow, isAddress } from "@/lib/config";
import { countdown, errorText, formatGen, fromUnix, parseGen, percent, short } from "@/lib/format";
import { FinalityBadge, Skeleton, StatusBadge, TxNotice, WalletGate } from "@/components/Bits";

type Data = {
  info: MonocleInfo;
  live: LiveInterpretation;
  round: RoundInfo;
  interpretations: Interpretation[];
  sources: SourceRecord[];
  log: Record<string, string>[];
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function MonoclePage() {
  const params = useParams<{ address: string }>();
  const address = (params?.address ?? "") as Address;
  const valid = isAddress(address);
  const { reader, writer, address: me } = useWallet();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tx = useTx();
  const now = useNow();

  const readCalls = useMemo(() => (valid ? new MonocleCalls(reader, address) : null), [reader, address, valid]);
  const writeCalls = useMemo(() => (valid && writer ? new MonocleCalls(writer, address) : null), [writer, address, valid]);

  const load = useCallback(async () => {
    if (!readCalls) return;
    try {
      const info = await readCalls.getInfo();
      const [live, round, interpretations, sources, logPage] = await Promise.all([
        readCalls.getLiveInterpretation(),
        readCalls.getRoundInfo(info.current_round),
        readCalls.getRoundInterpretations(info.current_round),
        readCalls.getSources(),
        readCalls.getAdjudicationLog(0, 50),
      ]);
      setData({ info, live, round, interpretations, sources, log: (logPage.entries ?? []).slice(-10).reverse() });
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, [readCalls]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [load]);

  const act = (label: string, fn: (m: MonocleCalls) => Promise<unknown>, explain?: () => Promise<string>) => {
    if (!writeCalls) return;
    void tx.run(label, () => fn(writeCalls), async () => {
      await load();
      return explain ? explain() : undefined;
    });
  };

  /** After adjudicate: say exactly what the round became. */
  const explainRound = (round: string) => async () => {
    if (!readCalls) return "";
    const r = await readCalls.getRoundInfo(round);
    const rec = r.reasoning as Partial<AdjudicationRecord>;
    switch (r.status) {
      case "decided_pending":
        return `Round ${round} is DECIDED (pending): winner ${r.pending_winner} at ${percent(rec.confidence)} confidence. It becomes final after the challenge window unless challenged.`;
      case "inconclusive":
        return `Round ${round} is INCONCLUSIVE (${rec.decision ?? "no decision"}${rec.reason ? `: ${rec.reason}` : ""}). Nothing moved; every backer can claim a full refund. A new round is open.`;
      case "unchanged":
        return `Round ${round} is UNCHANGED: the evidence matches the last final snapshot and nothing new was submitted. Full refunds; the live output stays.`;
      default:
        return `Round ${round} status: ${r.status}.`;
    }
  };

  if (!valid) {
    return (
      <div className="container page">
        <div className="notice error">That is not a valid contract address.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container page">
        {error ? <div className="notice error">Could not load this Monocle: {error}</div> : <Skeleton lines={5} />}
      </div>
    );
  }

  const { info, live, round, interpretations, sources, log } = data;
  const status = round.status;
  const isCreator = Boolean(me && me.toLowerCase() === info.creator.toLowerCase());
  const open = status === "open" && info.status === "active";
  const pendingWinner = round.pending_winner;
  const windowOpen = status === "decided_pending" && now / 1000 <= Number(round.challenge_deadline);

  return (
    <div className="container page">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row">
            <span className="badge accent">{info.interpretation_type}</span>
            <StatusBadge status={info.status} />
            <span className="small muted">
              Round {info.current_round} · <StatusBadge status={status} />
            </span>
          </div>
          <h1>{info.title}</h1>
          {info.description && (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 720 }}>
              {info.description}
            </p>
          )}
          <div className="small muted mono-break">
            {address} · creator {short(info.creator)}
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            {Number(info.challenge_window_seconds) < 3600 ? (
              <span className="badge pending">Demo window: {formatWindow(info.challenge_window_seconds)} on this deployment</span>
            ) : (
              <span className="badge">Challenge window {formatWindow(info.challenge_window_seconds)}</span>
            )}
          </div>
        </div>
        <Link href="/explore" className="btn small">
          ← All Monocles
        </Link>
      </div>

      <TxNotice phase={tx.phase} message={tx.message} />
      {tx.message && <div style={{ height: 12 }} />}

      <div className="two-col">
        <div className="stack">
          <LiveCard live={live} />
          <RoundCard
            round={round}
            interpretations={interpretations}
            now={now}
            open={open}
            windowOpen={windowOpen}
            pendingWinner={pendingWinner}
            minBond={info.min_challenge_bond}
            busy={tx.busy}
            canWrite={Boolean(writeCalls)}
            onBack={(id, amount) => act("Back interpretation", (m) => m.backInterpretation(id, amount))}
            onChallenge={(id, bond) => act("Challenge", (m) => m.challenge(info.current_round, id, bond))}
          />
          {open && (
            <SubmitCard
              info={info}
              busy={tx.busy}
              onSubmit={(content, claims, bond) =>
                act("Submit interpretation", (m) => m.submitInterpretation(content, claims, bond))
              }
            />
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="label">Round actions</div>
            <WalletGate>
              {status === "open" && (
                <button
                  className="btn primary"
                  disabled={tx.busy || interpretations.length === 0 || info.status === "closed"}
                  onClick={() => act("Adjudicate", (m) => m.adjudicate(), explainRound(info.current_round))}
                >
                  Adjudicate round {info.current_round}
                </button>
              )}
              {status === "open" && interpretations.length === 0 && (
                <span className="hint">Needs at least one interpretation.</span>
              )}
              {status === "decided_pending" && (
                <button
                  className="btn primary"
                  disabled={tx.busy || windowOpen}
                  onClick={() => act("Finalize", (m) => m.finalize(info.current_round))}
                >
                  {windowOpen ? `Finalize in ${countdown(round.challenge_deadline, now)}` : "Finalize verdict"}
                </button>
              )}
              {status === "challenged" && (
                <>
                  <button
                    className="btn primary"
                    disabled={tx.busy}
                    onClick={() => act("Resolve challenge", (m) => m.resolveChallenge(info.current_round))}
                  >
                    Resolve challenge
                  </button>
                  <button
                    className="btn small"
                    disabled={tx.busy}
                    onClick={() => act("Finalize (expired challenge)", (m) => m.finalize(info.current_round))}
                  >
                    Finalize if challenge expired (24h)
                  </button>
                </>
              )}
              {status === "open" && Number(round.opened_at) > 0 && now / 1000 > Number(round.opened_at) + 86400 && (
                <button
                  className="btn small"
                  disabled={tx.busy}
                  onClick={() => act("Cancel stale round", (m) => m.cancelRound(info.current_round))}
                >
                  Cancel stale round (refunds)
                </button>
              )}
            </WalletGate>
          </div>

          <ClaimCard
            calls={readCalls}
            me={me}
            currentRound={info.current_round}
            busy={tx.busy}
            canWrite={Boolean(writeCalls)}
            onSettle={(r) => act(`Settle round ${r}`, (m) => m.settle(r))}
            onClaim={(r) => act(`Claim round ${r}`, (m) => m.claim(r))}
          />

          <SourcesCard
            sources={sources}
            minBond={info.min_source_bond}
            closed={info.status !== "active"}
            busy={tx.busy}
            me={me}
            onAdd={(url, role, bond) => act("Add source", (m) => m.addSource(url, role, bond))}
            onClaimBond={(url) => act("Claim source bond", (m) => m.claimSourceBond(url))}
          />

          {isCreator && (
            <div className="card stack">
              <div className="label">Creator</div>
              {info.status === "active" && (
                <button className="btn small" disabled={tx.busy} onClick={() => act("Close Monocle", (m) => m.closeMonocle())}>
                  Start close (2h timelock)
                </button>
              )}
              {info.status === "closing" && (
                <>
                  <span className="hint">Close executable at {fromUnix(info.close_executable_at)}.</span>
                  <button className="btn small" disabled={tx.busy} onClick={() => act("Finalize close", (m) => m.finalizeClose())}>
                    Finalize close
                  </button>
                  <button className="btn small" disabled={tx.busy} onClick={() => act("Cancel close", (m) => m.cancelClose())}>
                    Cancel close
                  </button>
                </>
              )}
            </div>
          )}

          <div className="card">
            <div className="label">Adjudication log</div>
            <div className="list">
              {log.length === 0 && <div className="list-item muted">No adjudications yet.</div>}
              {log.map((entry, i) => (
                <div className="list-item" key={i}>
                  <div className="row between">
                    <span>Round {entry.round}</span>
                    <StatusBadge status={entry.outcome ?? ""} />
                  </div>
                  <div className="small muted">
                    {entry.winner_id ? `winner ${entry.winner_id} · ` : ""}confidence {entry.confidence} ·{" "}
                    {fromUnix(entry.evaluated_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaimList({ claims }: { claims: Interpretation["claims"] }) {
  return (
    <ul className="claims">
      {claims.map((c) => (
        <li key={c.id}>
          {c.statement}
          {c.core && <span className="muted"> · core</span>}
        </li>
      ))}
    </ul>
  );
}

function LiveCard({ live }: { live: LiveInterpretation }) {
  const interp = live.has_live ? (live.interpretation as Interpretation) : null;
  const reasoning = live.has_live ? (live.reasoning as AdjudicationRecord) : null;
  const pending = live.pending && "winner_id" in live.pending ? live.pending : null;
  return (
    <div className="card stack">
      <div className="row between">
        <div className="label">Live output</div>
        <FinalityBadge finality={live.finality} />
      </div>
      {!interp && <div className="muted small">No final output yet.</div>}
      {interp && reasoning && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>{interp.content}</div>
          <ClaimList claims={interp.claims} />
          <dl className="kv">
            <dt>Confidence</dt>
            <dd>{percent(reasoning.confidence)}</dd>
            <dt>Composite</dt>
            <dd>{percent(reasoning.composite_score)}</dd>
            <dt>Round</dt>
            <dd>{interp.round}</dd>
            <dt>Evidence hash</dt>
            <dd className="mono-break">{reasoning.evidence_hash || "—"}</dd>
            <dt>Evaluated</dt>
            <dd>{fromUnix(reasoning.evaluated_at)}</dd>
          </dl>
          {reasoning.reasoning && <p className="muted small" style={{ lineHeight: 1.7, margin: 0 }}>{reasoning.reasoning}</p>}
          <details>
            <summary className="small muted" style={{ cursor: "pointer" }}>
              Evidence fetched ({reasoning.evidence_snapshot.length}) and claim scores
            </summary>
            {reasoning.evidence_snapshot.map((e) => (
              <div key={e.url} style={{ marginTop: 10 }}>
                <div className="small mono-break">
                  <span className="badge">{e.role}</span> {e.url}
                </div>
                <div className="excerpt">{e.excerpt}</div>
              </div>
            ))}
            <div className="divider" />
            {reasoning.claim_scores.map((s) => (
              <div key={`${s.interpretation_id}-${s.claim_id}`} className="small" style={{ marginBottom: 6 }}>
                <span className={`verdict-${s.verdict}`}>{s.verdict}</span> · {s.interpretation_id}/{s.claim_id} · {s.statement}
              </div>
            ))}
          </details>
        </>
      )}
      {pending && (
        <div className="notice info">
          A newer verdict for round {pending.round} is pending (winner {pending.winner_id}). It becomes final after the
          challenge window unless successfully challenged.
        </div>
      )}
    </div>
  );
}

function RoundCard(props: {
  round: RoundInfo;
  interpretations: Interpretation[];
  now: number;
  open: boolean;
  windowOpen: boolean;
  pendingWinner: string;
  minBond: string;
  busy: boolean;
  canWrite: boolean;
  onBack: (id: string, amount: bigint) => void;
  onChallenge: (id: string, bond: bigint) => void;
}) {
  const { round, interpretations, now, open, windowOpen, pendingWinner } = props;
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const withAmount = (id: string, fn: (wei: bigint) => void) => {
    try {
      setErr(null);
      fn(parseGen(amounts[id] ?? ""));
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const reasoning = round.reasoning as AdjudicationRecord;
  return (
    <div className="card stack">
      <div className="row between">
        <div className="label">Current round · {round.round}</div>
        <span className="small muted">Pool {formatGen(round.pool)}</span>
      </div>
      {round.status === "decided_pending" && (
        <div className="notice info">
          Pending winner <strong>{pendingWinner}</strong> ({percent(reasoning?.confidence)} confidence). Challenge window:{" "}
          {windowOpen ? countdown(round.challenge_deadline, now) + " left" : "closed"}.
        </div>
      )}
      {round.status === "challenged" && (
        <div className="notice info">Challenged. Anyone can resolve it now; it expires 24h after the challenge.</div>
      )}
      {err && <div className="notice error">{err}</div>}
      <div className="list">
        {interpretations.length === 0 && <div className="list-item muted">No interpretations in this round yet.</div>}
        {interpretations.map((it) => (
          <div className="list-item" key={it.id}>
            <div className="row between">
              <span className="small muted">
                {it.id} · by {short(it.author)} · {it.stance}
              </span>
              <span className="small">
                {formatGen(it.total_stake)} · {it.backer_count} backer{it.backer_count === 1 ? "" : "s"}
                {it.id === pendingWinner && <span className="badge pending" style={{ marginLeft: 8 }}>pending winner</span>}
              </span>
            </div>
            <div style={{ marginTop: 6, lineHeight: 1.6 }}>{it.content}</div>
            <ClaimList claims={it.claims} />
            {props.canWrite && (open || (windowOpen && it.id !== pendingWinner)) && (
              <div className="row" style={{ marginTop: 10 }}>
                <input
                  className="input"
                  style={{ width: 130 }}
                  placeholder={open ? "GEN to back" : `bond ≥ ${formatGen(props.minBond)}`}
                  value={amounts[it.id] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [it.id]: e.target.value }))}
                />
                {open ? (
                  <button className="btn small" disabled={props.busy} onClick={() => withAmount(it.id, (w) => props.onBack(it.id, w))}>
                    Back
                  </button>
                ) : (
                  <button className="btn small" disabled={props.busy} onClick={() => withAmount(it.id, (w) => props.onChallenge(it.id, w))}>
                    Challenge with this
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmitCard(props: {
  info: MonocleInfo;
  busy: boolean;
  onSubmit: (content: string, claims: Record<string, unknown>, bond: bigint) => void;
}) {
  const schemaKeys = Object.keys(props.info.schema ?? {});
  const [content, setContent] = useState("");
  const [claimsText, setClaimsText] = useState("");
  const [stance, setStance] = useState<"assertion" | "refutation">("assertion");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [bond, setBond] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    try {
      setErr(null);
      const claims = claimsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = { ...fields, stance };
      if (claims.length) body.claims = claims;
      props.onSubmit(content.trim(), body, parseGen(bond));
    } catch (e) {
      setErr(errorText(e));
    }
  };

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 12 }}>
        Submit an interpretation
      </div>
      <WalletGate action="submit an interpretation">
        <div className="field">
          <label>Interpretation</label>
          <textarea className="textarea" maxLength={3000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What do the sources say, in plain words?" />
        </div>
        <div className="field">
          <label>Claims · one per line (first is core)</label>
          <textarea className="textarea" value={claimsText} onChange={(e) => setClaimsText(e.target.value)} placeholder={"BTC dominance rose this week\nETF inflows drove the move"} />
          <span className="hint">Each claim is scored against the fetched sources. Specific, checkable claims win.</span>
        </div>
        {schemaKeys.map((key) => (
          <div className="field" key={key}>
            <label>
              {key} · {props.info.schema[key]}
            </label>
            <input className="input" value={fields[key] ?? ""} onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}
        <div className="row">
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Stance</label>
            <select className="select" value={stance} onChange={(e) => setStance(e.target.value as "assertion" | "refutation")}>
              <option value="assertion">assertion</option>
              <option value="refutation">refutation</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Bond (GEN) · min {formatGen(props.info.min_interpretation_bond)}</label>
            <input className="input" value={bond} onChange={(e) => setBond(e.target.value)} placeholder="0.01" />
          </div>
        </div>
        {err && <div className="notice error" style={{ marginBottom: 12 }}>{err}</div>}
        <button className="btn primary" disabled={props.busy || !content.trim()} onClick={submit}>
          Submit and bond
        </button>
      </WalletGate>
    </div>
  );
}

function ClaimCard(props: {
  calls: MonocleCalls | null;
  me: Address | null;
  currentRound: string;
  busy: boolean;
  canWrite: boolean;
  onSettle: (round: string) => void;
  onClaim: (round: string) => void;
}) {
  const [roundInput, setRoundInput] = useState(() => String(Math.max(1, Number(props.currentRound) - 1)));
  const [state, setState] = useState<{ status: string; claimable: string; claimed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!props.calls || !/^\d+$/.test(roundInput)) return setState(null);
      try {
        const info = await props.calls.getRoundInfo(roundInput);
        const claimable = props.me ? await props.calls.getClaimable(roundInput, props.me) : "0";
        const claimed = props.me ? await props.calls.isClaimed(roundInput, props.me) : false;
        if (!cancelled) setState({ status: info.status, claimable, claimed });
      } catch {
        if (!cancelled) setState(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.calls, props.me, roundInput, props.busy]);

  return (
    <div className="card stack">
      <div className="label">Settle and claim</div>
      <div className="row">
        <input className="input" style={{ width: 90 }} value={roundInput} onChange={(e) => setRoundInput(e.target.value.trim())} aria-label="Round" />
        {state && <StatusBadge status={state.status || "unknown"} />}
      </div>
      {state && props.me && (
        <div className="small">
          Claimable for you: <strong>{formatGen(state.claimable)}</strong>
          {state.claimed && <span className="muted"> · already claimed</span>}
        </div>
      )}
      <WalletGate action="claim">
        {state?.status === "finalized" && (
          <button className="btn small" disabled={props.busy} onClick={() => props.onSettle(roundInput)}>
            Settle round {roundInput}
          </button>
        )}
        <button
          className="btn primary small"
          disabled={props.busy || !state || state.claimed || !["settled", "inconclusive", "cancelled", "unchanged"].includes(state.status)}
          onClick={() => props.onClaim(roundInput)}
        >
          Claim round {roundInput}
        </button>
        <span className="hint">
          Finalized → Settle → Claim. Inconclusive / cancelled / unchanged → Claim refund directly. Winners are paid
          pro-rata; losers can claim 0 to close out.
        </span>
      </WalletGate>
    </div>
  );
}

function SourcesCard(props: {
  sources: SourceRecord[];
  minBond: string;
  closed: boolean;
  busy: boolean;
  me: Address | null;
  onAdd: (url: string, role: "primary" | "corroborating" | "contradicting", bond: bigint) => void;
  onClaimBond: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [role, setRole] = useState<"primary" | "corroborating" | "contradicting">("corroborating");
  const [bond, setBond] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card">
      <div className="label">Sources · {props.sources.length}/8</div>
      <div className="list">
        {props.sources.map((s) => (
          <div className="list-item" key={s.url}>
            <div className="row between">
              <span className="badge">{s.role}</span>
              <span className={`small ${s.last_fetch_ok ? "verdict-supported" : "muted"}`}>
                {s.last_fetched_at === "0" ? "not fetched yet" : s.last_fetch_ok ? "fetched" : `missed ×${s.misses}`}
              </span>
            </div>
            <a className="small mono-break" href={s.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6 }}>
              {s.url} ↗
            </a>
            {s.bond_status !== "none" && (
              <div className="small muted" style={{ marginTop: 4 }}>
                bond {formatGen(s.add_bond)} · {s.bond_status}
                {s.bond_status === "refundable" && props.me && s.added_by.toLowerCase() === props.me.toLowerCase() && (
                  <button className="btn small" style={{ marginLeft: 8 }} disabled={props.busy} onClick={() => props.onClaimBond(s.url)}>
                    Claim bond
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {!props.closed && props.sources.length < 8 && (
        <WalletGate action="add a source">
          <div className="divider" />
          <div className="field">
            <label>Add a source</label>
            <input className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="row">
            <select className="select" style={{ flex: 1 }} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="corroborating">corroborating</option>
              <option value="contradicting">contradicting</option>
              <option value="primary">primary</option>
            </select>
            <input className="input" style={{ flex: 1 }} placeholder={`bond ≥ ${formatGen(props.minBond)}`} value={bond} onChange={(e) => setBond(e.target.value)} />
          </div>
          {err && <div className="notice error" style={{ marginTop: 10 }}>{err}</div>}
          <button
            className="btn small"
            style={{ marginTop: 10 }}
            disabled={props.busy || !/^https?:\/\//i.test(url.trim())}
            onClick={() => {
              try {
                setErr(null);
                props.onAdd(url.trim(), role, parseGen(bond));
              } catch (e) {
                setErr(errorText(e));
              }
            }}
          >
            Add source
          </button>
          <p className="hint">Refunded once the source fetches successfully; forfeited after repeated misses.</p>
        </WalletGate>
      )}
    </div>
  );
}
