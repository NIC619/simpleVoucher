"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 border border-line text-sm font-medium text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (connectors.length <= 1) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-[var(--radius)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isPending}
        className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-[var(--radius)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-1.5 w-52 bg-surface border border-line rounded-[var(--radius)] shadow-paper z-50 overflow-hidden">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--text)] hover:bg-surface-soft transition-colors"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
