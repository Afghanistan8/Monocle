"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "genlayer-js";
import {
  createReadClient,
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_EXPLORER,
  STUDIO_NEXT_RPC,
  studioNext,
  type Address,
  type MonocleClient,
} from "@monocle/sdk";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

const CHAIN_HEX = `0x${STUDIO_NEXT_CHAIN_ID.toString(16)}`;

interface WalletState {
  address: Address | null;
  reader: MonocleClient;
  writer: MonocleClient | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

async function ensureStudioNext(provider: Eip1193) {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === CHAIN_HEX) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902 && code !== -32603) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: "GenLayer Studio Next",
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [STUDIO_NEXT_RPC],
          blockExplorerUrls: [STUDIO_NEXT_EXPLORER],
        },
      ],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const reader = useMemo(() => createReadClient(), []);
  const [address, setAddress] = useState<Address | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const provider = window.ethereum;
    setHasWallet(Boolean(provider));
    if (!provider) return;
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const first = (accounts as string[])[0];
        if (first) setAddress(first as Address);
      })
      .catch(() => undefined);
    const onAccounts = (...args: unknown[]) => {
      const list = args[0] as string[];
      setAddress(list?.[0] ? (list[0] as Address) : null);
    };
    provider.on?.("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const writer = useMemo(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!address || !provider) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createClient({ chain: studioNext, account: address, provider: provider as any }) as MonocleClient;
  }, [address]);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setError("No browser wallet found. Install MetaMask (or another EVM wallet) to transact.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      await ensureStudioNext(provider);
      setAddress((accounts[0] as Address) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  const value = useMemo<WalletState>(
    () => ({ address, reader, writer, connecting, error, hasWallet, connect, disconnect }),
    [address, reader, writer, connecting, error, hasWallet, connect, disconnect],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
