"use client";

import { useCallback, useState } from "react";
import { errorText } from "./format";

export type TxPhase = "idle" | "pending" | "success" | "error";

/**
 * Drives one write. The SDK call itself estimates fees, submits, waits for
 * FINALIZED and rejects anything that is not FINISHED_WITH_RETURN, so
 * "success" here always means a genuinely finalized, non-reverted write.
 */
export function useTx() {
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>, onDone?: (result: T) => void) => {
    setPhase("pending");
    setMessage(`${label}: confirm in your wallet, then waiting for FINALIZED…`);
    try {
      const result = await fn();
      setPhase("success");
      setMessage(`${label}: finalized.`);
      onDone?.(result);
      return result;
    } catch (err) {
      setPhase("error");
      setMessage(`${label} failed: ${errorText(err)}`);
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setMessage(null);
  }, []);

  return { phase, message, run, reset, busy: phase === "pending" };
}
