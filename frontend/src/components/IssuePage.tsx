"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS } from "@/config/contract";
import { VoucherGenerator } from "./VoucherGenerator";

type VoucherType = "basic" | "binding";

export function IssuePage() {
  const [voucherType, setVoucherType] = useState<VoucherType>("basic");
  const [topic, setTopic] = useState("");
  const [submittedTopic, setSubmittedTopic] = useState("");
  const [voucherHashesInput, setVoucherHashesInput] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const redeemUrl = isSuccess && address && submittedTopic
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${address}/${encodeURIComponent(submittedTopic)}`
    : "";

  const copyRedeemUrl = async () => {
    if (redeemUrl) {
      await navigator.clipboard.writeText(redeemUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  const parseVoucherHashes = (input: string): `0x${string}`[] => {
    return input
      .split(/[\n,]/)
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => (h.startsWith("0x") ? h : `0x${h}`) as `0x${string}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!SIMPLE_VOUCHER_ADDRESS) {
      alert("Contract address not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
      return;
    }

    const hashes = parseVoucherHashes(voucherHashesInput);
    if (hashes.length === 0) {
      alert("Please enter at least one voucher hash");
      return;
    }

    setSubmittedTopic(topic);
    setUrlCopied(false);

    writeContract({
      address: SIMPLE_VOUCHER_ADDRESS,
      abi: SIMPLE_VOUCHER_ABI,
      functionName: "issueBasicVouchers",
      args: [topic, hashes],
    });
  };

  const handleUseVouchers = (hashes: string[]) => {
    setVoucherHashesInput(hashes.join("\n"));
  };

  return (
    <div className="space-y-6">
      {/* Voucher Type Selection */}
      <div className="flex gap-4">
        <button
          onClick={() => setVoucherType("basic")}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            voucherType === "basic"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Basic Voucher
        </button>
        <button
          disabled
          className="flex-1 py-3 px-4 rounded-lg font-medium bg-gray-800 text-gray-500 cursor-not-allowed relative group"
        >
          Binding Voucher
          <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
            Soon
          </span>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-gray-300 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Binding Voucher binds to a specific redeemer address. Coming soon!
          </div>
        </button>
      </div>

      {/* Issue Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., event-2024, promotion-summer"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voucher Hashes (one per line or comma-separated)
          </label>
          <textarea
            value={voucherHashesInput}
            onChange={(e) => setVoucherHashesInput(e.target.value)}
            placeholder="0x1234...abcd&#10;0x5678...efgh"
            rows={6}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            required
          />
          <p className="mt-1 text-sm text-gray-400">
            {parseVoucherHashes(voucherHashesInput).length} voucher(s) to issue
          </p>
        </div>

        {/* Redeem URL Preview */}
        {isConnected && topic && (
          <div className="p-4 bg-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Redeem Link Preview
            </h3>
            <p className="text-sm text-gray-400 mb-2">
              After issuing, share this link with voucher holders:
            </p>
            <code className="block p-2 bg-gray-900 rounded text-xs text-blue-400 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/{address}/{encodeURIComponent(topic)}
            </code>
          </div>
        )}

        {!isConnected ? (
          <p className="text-yellow-500">Please connect your wallet to issue vouchers</p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming || !topic || !voucherHashesInput}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {isPending
              ? "Confirm in Wallet..."
              : isConfirming
              ? "Confirming..."
              : "Issue Vouchers"}
          </button>
        )}

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
            Error: {error.message}
          </div>
        )}

        {isSuccess && (
          <div className="p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-300 text-sm space-y-3">
            <p className="font-medium">Vouchers issued successfully!</p>
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline block"
            >
              View transaction
            </a>

            {redeemUrl && (
              <div className="pt-3 border-t border-green-700">
                <p className="text-gray-300 mb-2">Share this redeem link with voucher holders:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-gray-900 rounded text-xs text-blue-400 break-all">
                    {redeemUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyRedeemUrl}
                    className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-white text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    {urlCopied ? "Copied!" : "Copy URL"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Voucher Generator Helper */}
      <VoucherGenerator onUseVouchers={handleUseVouchers} />
    </div>
  );
}
