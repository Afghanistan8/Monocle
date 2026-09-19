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

export const CHAIN_HEX = `0x${STUDIO_NEXT_CHAIN_ID.toString(16)}`;

interface WalletState {
  address: Address | null;
  /** Chain id the wallet is currently on, or null if unknown / no wallet. */
  walletChainId: number | null;
  wrongNetwork: boolean;
  reader: MonocleClient;
  writer: MonocleClient | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

function describe(err: unknown, fallback: string): string {
  const e = err as { message?: string; code?: number } | undefined;
  if (e?.code === 4001) return "Request rejected in the wallet.";
  return e?.message ?? fallback;
}

async function ensureStudioNext(provider: Eip1193) {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === CHAIN_HEX) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    // 4902: unknown chain. Some wallets report it as -32603.
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
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  const readChain = useCallback(async (provider: Eip1193) => {
    try {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      setWalletChainId(Number.parseInt(hex, 16));
    } catch {
      setWalletChainId(null);
    }
  }, []);

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
    void readChain(provider);
    const onAccounts = (...args: unknown[]) => {
      const list = args[0] as string[];
      setAddress(list?.[0] ? (list[0] as Address) : null);
    };
    const onChain = (...args: unknown[]) => setWalletChainId(Number.parseInt(String(args[0]), 16));
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [readChain]);

  const wrongNetwork = Boolean(address && walletChainId !== null && walletChainId !== STUDIO_NEXT_CHAIN_ID);

  const writer = useMemo(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!address || !provider || wrongNetwork) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createClient({ chain: studioNext, account: address, provider: provider as any }) as MonocleClient;
  }, [address, wrongNetwork]);

  const switchNetwork = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    setError(null);
    try {
      await ensureStudioNext(provider);
    } catch (err) {
      setError(describe(err, "Could not switch to GenLayer Studio Next."));
    } finally {
      await readChain(provider);
    }
  }, [readChain]);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setError("No browser wallet found. Install MetaMask (or any EIP-1193 wallet) to transact.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAddress((accounts[0] as Address) ?? null);
      await ensureStudioNext(provider);
    } catch (err) {
      setError(describe(err, "Wallet connection failed."));
    } finally {
      await readChain(provider);
      setConnecting(false);
    }
  }, [readChain]);

  const disconnect = useCallback(() => setAddress(null), []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      walletChainId,
      wrongNetwork,
      reader,
      writer,
      connecting,
      error,
      hasWallet,
      connect,
      switchNetwork,
      disconnect,
    }),
    [address, walletChainId, wrongNetwork, reader, writer, connecting, error, hasWallet, connect, switchNetwork, disconnect],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
