import Link from "next/link";
import Globe from "@/components/Globe";
import LiveStats, { SeededMarketCard } from "@/components/LiveStats";
import { HealthBar } from "@/components/Health";
import { DEPLOYMENT } from "@/lib/deployment";
import { formatWindow } from "@/lib/format";

const WINDOW = DEPLOYMENT.challengeWindowSeconds;
const WINDOW_TEXT = `${formatWindow(WINDOW)}${WINDOW < 3600 ? " on this deployment" : ""}`;

const PHASES = [
  {
    n: "01",
    title: "Open",
    body: "Anyone opens a Monocle on two or more live sources, with an optional schema every interpretation must fill.",
  },
  {
    n: "02",
    title: "Interpret",
    body: "Participants bond GEN behind structured claims. Others back the reading they believe. Duplicates are rejected.",
  },
  {
    n: "03",
    title: "Adjudicate",
    body: "Validators re-fetch every source and score each claim supported, contradicted or insufficient. Thin evidence fails closed.",
  },
  {
    n: "04",
    title: "Challenge",
    body: `A verdict stays pending for ${WINDOW_TEXT}. A bonded challenger can pit an alternative against it before anything is final.`,
  },
  {
    n: "05",
    title: "Finalize",
    body: "The winner becomes the FINAL live output any agent can read. Backers settle, and a fresh round opens at once.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="globe-stage">
            <Globe />
            <span className="globe-tag">
              <span className="dot" /> Live · Studio Next
            </span>
          </div>
          <h1>
            Every claim, staked.
            <br />
            Finalized.
          </h1>
          <p className="lede">
            A capital-backed interpretation engine on GenLayer. Bond GEN behind claims about live sources, let
            independent validators judge the evidence, and read the final answer from any agent.
          </p>
          <div className="hero-cta">
            <Link href="/explore" className="btn primary">
              Explore Monocles
            </Link>
            <Link href="/create" className="btn">
              Open a Monocle
            </Link>
          </div>
          <div style={{ maxWidth: 760, margin: "36px auto 0", textAlign: "left" }} className="stack">
            <HealthBar showSetup={false} />
            <SeededMarketCard />
          </div>
        </div>
        <div className="side-index" aria-hidden>
          05
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <div className="eyebrow">Five phases</div>
          <h2>From live sources to a final answer.</h2>
          <p className="sub">
            Nothing moves on a guess. No evidence, low confidence or an invalid verdict refunds every backer, and a pending
            verdict can still be challenged before it becomes final.
          </p>
          <div className="phases">
            {PHASES.map((p) => (
              <div className="phase" key={p.n}>
                <span className="num">{p.n}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="agents">
        <div className="container">
          <div className="eyebrow">For agents and contracts</div>
          <h2>One read. Finality included.</h2>
          <p className="sub">
            <code>get_live_interpretation()</code> returns the winning interpretation, its claim-level scores, the evidence
            excerpts actually fetched, an evidence hash, and a <code>finality</code> flag. Act only on{" "}
            <code>&quot;final&quot;</code>. TypeScript and Python SDKs ship with the repo.
          </p>
          <LiveStats />
        </div>
      </section>
    </>
  );
}
