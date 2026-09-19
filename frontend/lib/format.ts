const WEI = 10n ** 18n;

/** Wei (decimal string or bigint) -> "1.25 GEN". */
export function formatGen(wei: string | bigint | number | undefined, digits = 4): string {
  let value: bigint;
  try {
    value = BigInt(wei ?? 0);
  } catch {
    return "0 GEN";
  }
  const whole = value / WEI;
  const frac = value % WEI;
  if (frac === 0n) return `${whole} GEN`;
  const fracText = frac.toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  if (!fracText) return `${whole === 0n && value > 0n ? "<0." + "0".repeat(digits - 1) + "1" : whole} GEN`;
  return `${whole}.${fracText} GEN`;
}

/** "1.5" GEN -> wei bigint. Throws on malformed input. */
export function parseGen(input: string): bigint {
  const text = input.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(text)) throw new Error("Enter an amount like 0.5");
  const [whole, frac = ""] = text.split(".");
  return BigInt(whole) * WEI + BigInt(frac.padEnd(18, "0"));
}

export function short(address: string | undefined, head = 6, tail = 4): string {
  if (!address) return "";
  return address.length > head + tail + 2 ? `${address.slice(0, head)}…${address.slice(-tail)}` : address;
}

export function fromUnix(seconds: string | number | undefined): string {
  const n = Number(seconds ?? 0);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString();
}

export function countdown(targetSeconds: string | number | undefined, nowMs: number): string {
  const target = Number(targetSeconds ?? 0) * 1000;
  if (!target) return "—";
  const diff = Math.max(0, target - nowMs);
  if (diff === 0) return "elapsed";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function percent(score: string | undefined): string {
  const n = Number(score ?? 0);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/rate limit/i.test(raw)) {
    return "The public Studio Next RPC rate limit was reached for your connection (500 requests per hour). Wait a while and refresh.";
  }
  if (/server busy|execution slots occupied/i.test(raw)) {
    return "Studio Next is busy right now (all execution slots occupied). Try again in a moment.";
  }
  return raw.replace(/^UserError\((['"])(.*)\1\)$/, "$2");
}

/** Seconds -> "3m" / "1h" / "45s". */
export function formatWindow(seconds: number | string | undefined): string {
  const s = Number(seconds ?? 0);
  if (!s) return "—";
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}
