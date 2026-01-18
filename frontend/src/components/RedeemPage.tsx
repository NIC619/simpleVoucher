"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS } from "@/config/contract";

interface RedeemPageProps {
  prefillIssuer?: string;
  prefillTopic?: string;
}

export function RedeemPage({ prefillIssuer, prefillTopic }: RedeemPageProps) {
  const [issuer, setIssuer] = useState(prefillIssuer || "");
  const [topic, setTopic] = useState(prefillTopic || "");
  const [voucher, setVoucher] = useState("");
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (prefillIssuer) setIssuer(prefillIssuer);
    if (prefillTopic) setTopic(prefillTopic);
  }, [prefillIssuer, prefillTopic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!SIMPLE_VOUCHER_ADDRESS) {
      alert("Contract address not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
      return;
    }

    const voucherValue = voucher.startsWith("0x") ? voucher : `0x${voucher}`;

    writeContract({
      address: SIMPLE_VOUCHER_ADDRESS,
      abi: SIMPLE_VOUCHER_ABI,
      functionName: "redeemVoucher",
      args: [issuer as `0x${string}`, topic, voucherValue as `0x${string}`],
    });
  };

  const handleReset = () => {
    reset();
    setVoucher("");
  };

  return (
    <div className="space-y-6">
      {(prefillIssuer || prefillTopic) && (
        <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg text-blue-300 text-sm">
          Redeeming voucher from issuer{" "}
          <span className="font-mono">{prefillIssuer?.slice(0, 6)}...{prefillIssuer?.slice(-4)}</span>
          {prefillTopic && (
            <>
              {" "}under topic <span className="font-semibold">&quot;{prefillTopic}&quot;</span>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Issuer Address
          </label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            required
            readOnly={!!prefillIssuer}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., event-2024"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            readOnly={!!prefillTopic}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voucher (raw value, not hash)
          </label>
          <input
            type="text"
            value={voucher}
            onChange={(e) => setVoucher(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            required
          />
          <p className="mt-1 text-sm text-gray-400">
            Enter the raw voucher value you received from the issuer
          </p>
        </div>

        {!isConnected ? (
          <p className="text-yellow-500">Please connect your wallet to redeem</p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming || !issuer || !topic || !voucher}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {isPending
              ? "Confirm in Wallet..."
              : isConfirming
              ? "Confirming..."
              : "Redeem Voucher"}
          </button>
        )}

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
            Error: {error.message}
          </div>
        )}

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-300 text-sm space-y-2">
            <p>Voucher redeemed successfully!</p>
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline block"
            >
              View transaction
            </a>
            <button
              onClick={handleReset}
              className="text-sm px-3 py-1 bg-green-700 hover:bg-green-600 rounded transition-colors"
            >
              Redeem Another
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
