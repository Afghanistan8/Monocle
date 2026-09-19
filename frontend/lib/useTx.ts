"use client";

import { useCallback, useState } from "react";
import { MonocleTransactionError } from "@monocle/sdk";
import { errorText } from "./format";

export type TxPhase = "idle" | "pending" | "success" | "error";

export const PENDING_COPY =
  "Wallet confirm, then GenLayer consensus. Adjudicate can take several minutes and may rotate leaders.";

function failureText(err: unknown): string {
  if (err instanceof MonocleTransactionError) {
    const o = err.outcome;
    return `${o.reason ?? "Transaction failed."} (status ${o.status}, execution ${o.executionResult})`;
  }
  return errorText(err);
}

/**
 * Drives one write. The SDK call estimates fees, submits, waits for FINALIZED
 * and rejects anything that is not FINISHED_WITH_RETURN, so "success" here
 * always means a genuinely finalized, non-reverted write. `onDone` may
 * return a follow-up message (e.g. the round outcome after adjudicate).
 */
export function useTx() {
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>, onDone?: (result: T) => void | string | Promise<void | string>) => {
      setPhase("pending");
      setMessage(`${label}: ${PENDING_COPY}`);
      let result: T;
      try {
        result = await fn();
      } catch (err) {
        setPhase("error");
        setMessage(`${label} failed: ${failureText(err)}`);
        return undefined;
      }
      setPhase("success");
      setMessage(`${label}: finalized.`);
      try {
        const follow = await onDone?.(result);
        if (typeof follow === "string" && follow) setMessage(`${label}: finalized. ${follow}`);
      } catch {
        /* a failed refresh does not undo a finalized write */
      }
      return result;
    },
    [],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setMessage(null);
  }, []);

  return { phase, message, run, reset, busy: phase === "pending" };
}
