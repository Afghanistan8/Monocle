"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { short } from "@/lib/format";
import { GITHUB_URL } from "@/lib/config";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/create", label: "Create" },
  { href: "/#how", label: "How it works" },
  { href: "/#agents", label: "For agents" },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

export default function Nav() {
  const pathname = usePathname();
  const { address, connect, disconnect, connecting, wrongNetwork, switchNetwork } = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Main">
        <Link href="/" className="brand" aria-label="Monocle home" onClick={() => setOpen(false)}>
          <span className="brand-name">
            Mono<em>cle</em>
          </span>
          <span className="brand-dots" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </Link>

        <div className={`nav-links${open ? " open" : ""}`}>
          {LINKS.map((link) =>
            link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label} ↗
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "active" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
        </div>

        <div className="nav-right">
          <Link href="/explore" className="icon-btn" aria-label="Search Monocles">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          {address &&
            (wrongNetwork ? (
              <button className="net-badge bad" onClick={() => void switchNetwork()} title="Switch to GenLayer Studio Next">
                Wrong network
              </button>
            ) : (
              <span className="net-badge">
                <span className="dot ok" style={{ width: 6, height: 6 }} />
                Studio Next · 61997
              </span>
            ))}
          {address ? (
            <button className="pill" onClick={disconnect} title="Disconnect">
              <span className="dot ok" />
              {short(address)}
            </button>
          ) : (
            <button className="pill" onClick={connect} disabled={connecting}>
              <span className="dot" />
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </nav>
    </div>
  );
}
