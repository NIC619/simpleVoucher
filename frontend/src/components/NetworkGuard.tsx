"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { targetChain } from "@/config/wagmi";

interface NetworkGuardProps {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== targetChain.id;

  if (isWrongNetwork) {
    return (
      <div
        className="p-6 border rounded-[var(--radius)] text-center space-y-4"
        style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}
      >
        <p className="font-medium">Wrong Network</p>
        <p className="text-sm">
          Please switch to <span className="font-semibold">{targetChain.name}</span> to use this app.
        </p>
        <button
          onClick={() => switchChain({ chainId: targetChain.id })}
          disabled={isPending}
          className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Switching..." : `Switch to ${targetChain.name}`}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
