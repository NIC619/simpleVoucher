"use client";

import { useState, useMemo } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256 } from "viem";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS } from "@/config/contract";
import { targetChain } from "@/config/wagmi";
import { VoucherGenerator } from "./VoucherGenerator";

type VoucherType = "basic" | "binding";
type UseCase = "post";

const useCaseConfig: Record<UseCase, { label: string; description: string; urlPrefix: string; color: string; hoverColor: string }> = {
  post: {
    label: "Post Message",
    description: "Anonymous posting - voucher holder can post a message to the bulletin board",
    urlPrefix: "/post",
    color: "bg-purple-600",
    hoverColor: "hover:bg-purple-700",
  },
};

export function IssuePage() {
  const [voucherType, setVoucherType] = useState<VoucherType>("basic");
  const [useCase, setUseCase] = useState<UseCase>("post");
  const [topic, setTopic] = useState("");
  const [submittedTopic, setSubmittedTopic] = useState("");
  const [vouchersInput, setVouchersInput] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [copiedPreviewUrl, setCopiedPreviewUrl] = useState<string | null>(null);
  const { address, isConnected } = useAccount();

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const currentConfig = useCaseConfig[useCase];

  const redeemUrl = isSuccess && address && submittedTopic
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${currentConfig.urlPrefix}/${address}/${encodeURIComponent(submittedTopic)}`
    : "";

  const copyRedeemUrl = async () => {
    if (redeemUrl) {
      await navigator.clipboard.writeText(redeemUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  const copyPreviewUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedPreviewUrl(id);
    setTimeout(() => setCopiedPreviewUrl(null), 2000);
  };

  // Parse raw vouchers from input
  const parseVouchers = (input: string): `0x${string}`[] => {
    return input
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => (v.startsWith("0x") ? v : `0x${v}`) as `0x${string}`);
  };

  // Compute hashes from vouchers
  const { vouchers, voucherHashes } = useMemo(() => {
    const vouchers = parseVouchers(vouchersInput);
    const voucherHashes = vouchers.map((v) => keccak256(v));
    return { vouchers, voucherHashes };
  }, [vouchersInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!SIMPLE_VOUCHER_ADDRESS) {
      alert("Contract address not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
      return;
    }

    if (voucherHashes.length === 0) {
      alert("Please enter at least one voucher");
      return;
    }

    setSubmittedTopic(topic);
    setUrlCopied(false);

    writeContract({
      address: SIMPLE_VOUCHER_ADDRESS,
      abi: SIMPLE_VOUCHER_ABI,
      functionName: "issueBasicVouchers",
      args: [topic, voucherHashes],
    });
  };

  const handleUseVouchers = (rawVouchers: string[]) => {
    setVouchersInput(rawVouchers.join("\n"));
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

      {/* Use Case Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Voucher Use Case
        </label>
        <div className="flex gap-3">
          {(Object.keys(useCaseConfig) as UseCase[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setUseCase(key)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
                useCase === key
                  ? `${useCaseConfig[key].color} text-white`
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {useCaseConfig[key].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {currentConfig.description}
        </p>
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
            Vouchers (one per line or comma-separated)
          </label>
          <textarea
            value={vouchersInput}
            onChange={(e) => setVouchersInput(e.target.value)}
            placeholder="0x1234...abcd&#10;0x5678...efgh"
            rows={4}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            required
          />
          <p className="mt-1 text-sm text-gray-400">
            {vouchers.length} voucher(s) - these are the raw values to share with redeemers
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voucher Hashes (auto-computed, stored on-chain)
          </label>
          <textarea
            value={voucherHashes.join("\n")}
            readOnly
            rows={4}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-400 font-mono text-sm cursor-not-allowed"
            placeholder="Hashes will appear here..."
          />
        </div>

        {/* URL Preview */}
        {isConnected && topic && (
          <div className="p-4 bg-gray-800 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-gray-300">
              {currentConfig.label} Link Preview
            </h3>

            {vouchers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">
                    Share these links with voucher holders:
                  </p>
                  {vouchers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allUrls = vouchers.map(v =>
                          `${typeof window !== "undefined" ? window.location.origin : ""}${currentConfig.urlPrefix}/${address}/${encodeURIComponent(topic)}/${v}`
                        ).join("\n");
                        copyPreviewUrl(allUrls, "all");
                      }}
                      className={`px-3 py-1 rounded text-white text-xs font-medium transition-colors ${currentConfig.color} ${currentConfig.hoverColor}`}
                    >
                      {copiedPreviewUrl === "all" ? "Copied!" : "Copy All"}
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {vouchers.map((v, i) => {
                    const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${currentConfig.urlPrefix}/${address}/${encodeURIComponent(topic)}/${v}`;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-gray-900 rounded text-xs break-all text-purple-400">
                          {fullUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyPreviewUrl(fullUrl, `voucher-${i}`)}
                          className={`px-3 py-2 rounded text-white text-xs font-medium transition-colors whitespace-nowrap ${currentConfig.color} ${currentConfig.hoverColor}`}
                        >
                          {copiedPreviewUrl === `voucher-${i}` ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {vouchers.length} {currentConfig.label.toLowerCase()} link(s)
                </p>
              </div>
            )}

            {vouchers.length === 0 && (
              <p className="text-sm text-gray-500">
                Enter vouchers above to see preview links
              </p>
            )}
          </div>
        )}

        {!isConnected ? (
          <p className="text-yellow-500">Please connect your wallet to issue vouchers</p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming || !topic || vouchers.length === 0}
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
            {targetChain.blockExplorers?.default && (
              <a
                href={`${targetChain.blockExplorers.default.url}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline block"
              >
                View transaction on {targetChain.blockExplorers.default.name}
              </a>
            )}

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
