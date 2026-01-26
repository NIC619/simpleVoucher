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
      <div className="p-6 bg-yellow-900/30 border border-yellow-500/50 rounded-lg text-center space-y-4">
        <p className="text-yellow-300 font-medium">Wrong Network</p>
        <p className="text-gray-300">
          Please switch to <span className="font-semibold">{targetChain.name}</span> to use this app.
        </p>
        <button
          onClick={() => switchChain({ chainId: targetChain.id })}
          disabled={isPending}
          className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 rounded-lg font-medium transition-colors"
        >
          {isPending ? "Switching..." : `Switch to ${targetChain.name}`}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
