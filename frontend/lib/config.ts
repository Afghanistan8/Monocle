"use client";

import type { Address } from "@monocle/sdk";
import { DEPLOYMENT } from "./deployment";

const STORAGE_KEY = "monocle.factory";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export { DEPLOYMENT };

/** Optional build-time override (Vercel env). */
export const ENV_FACTORY = (process.env.NEXT_PUBLIC_MONOCLE_FACTORY ?? "").trim();

export const GITHUB_URL = "https://github.com/Afghanistan8/Monocle";
export const STUDIO_URL = "https://studio-next.genlayer.com";
export const EXPLORER_URL = "https://explorer-studio-dev.genlayer.com";
export const DEPLOY_COMMAND = "CHALLENGE_WINDOW_SECONDS=180 npm run deploy:studio-next";

export type FactorySource = "browser" | "env" | "deployment" | "none";

export function isAddress(value: string): value is Address {
  return ADDRESS_RE.test(value.trim());
}

export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

function stored(): string {
  try {
    return (window.localStorage.getItem(STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Factory precedence: a per-browser override (for Studio Next resets), then
 * the NEXT_PUBLIC_MONOCLE_FACTORY build env, then the committed deployment
 * default generated from deploy/deployments.json.
 */
export function resolveFactory(): { factory: Address | null; source: FactorySource } {
  const local = stored();
  if (isAddress(local)) return { factory: local as Address, source: "browser" };
  if (isAddress(ENV_FACTORY)) return { factory: ENV_FACTORY as Address, source: "env" };
  if (isAddress(DEPLOYMENT.factory)) return { factory: DEPLOYMENT.factory as Address, source: "deployment" };
  return { factory: null, source: "none" };
}

export function getFactoryAddress(): Address | null {
  return resolveFactory().factory;
}

export function setFactoryAddress(value: string): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: env / deployment defaults still apply */
  }
}

export function formatWindow(seconds: number | string | undefined): string {
  const s = Number(seconds ?? 0);
  if (!s) return "—";
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}
