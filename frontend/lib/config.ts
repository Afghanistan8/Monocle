"use client";

import type { Address } from "@monocle/sdk";

const STORAGE_KEY = "monocle.factory";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Factory address baked in at build time (Vercel env), if any. */
export const DEFAULT_FACTORY = (process.env.NEXT_PUBLIC_MONOCLE_FACTORY ?? "").trim();

export const GITHUB_URL = "https://github.com/Afghanistan8/Monocle";

export function isAddress(value: string): value is Address {
  return ADDRESS_RE.test(value.trim());
}

/**
 * Studio Next state can be reset, so the factory address is configurable
 * per browser as well as at build time.
 */
export function getFactoryAddress(): Address | null {
  let stored = "";
  try {
    stored = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    stored = "";
  }
  const candidate = (stored || DEFAULT_FACTORY).trim();
  return isAddress(candidate) ? (candidate as Address) : null;
}

export function setFactoryAddress(value: string): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the build-time default still applies */
  }
}
