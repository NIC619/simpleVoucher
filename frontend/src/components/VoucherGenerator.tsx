"use client";

import { useState } from "react";
import { keccak256, toHex } from "viem";

interface VoucherGeneratorProps {
  onUseVouchers: (voucherHashes: string[]) => void;
}

export function VoucherGenerator({ onUseVouchers }: VoucherGeneratorProps) {
  const [count, setCount] = useState(5);
  const [generatedVouchers, setGeneratedVouchers] = useState<string[]>([]);
  const [generatedHashes, setGeneratedHashes] = useState<string[]>([]);
  const [copied, setCopied] = useState<"vouchers" | "hashes" | null>(null);

  const generateVouchers = () => {
    const vouchers: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate random 32 bytes
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const voucher = toHex(randomBytes);
      vouchers.push(voucher);

      // Hash the voucher
      const hash = keccak256(voucher);
      hashes.push(hash);
    }

    setGeneratedVouchers(vouchers);
    setGeneratedHashes(hashes);
  };

  const copyToClipboard = async (
    items: string[],
    type: "vouchers" | "hashes"
  ) => {
    await navigator.clipboard.writeText(items.join("\n"));
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const useHashes = () => {
    onUseVouchers(generatedHashes);
  };

  return (
    <div className="mt-8 p-4 border border-gray-600 rounded-lg bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">Voucher Generator Helper</h3>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-300">Number of vouchers:</label>
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
        />
        <button
          onClick={generateVouchers}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
        >
          Generate
        </button>
      </div>

      {generatedVouchers.length > 0 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">
                Raw Vouchers (keep these secret, give to redeemers):
              </span>
              <button
                onClick={() => copyToClipboard(generatedVouchers, "vouchers")}
                className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {copied === "vouchers" ? "Copied!" : "Copy All"}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-gray-900 p-2 rounded text-xs font-mono">
              {generatedVouchers.map((v, i) => (
                <div key={i} className="text-gray-400 truncate">
                  {v}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">
                Voucher Hashes (submit these to the contract):
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(generatedHashes, "hashes")}
                  className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  {copied === "hashes" ? "Copied!" : "Copy All"}
                </button>
                <button
                  onClick={useHashes}
                  className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
                >
                  Use These Hashes
                </button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto bg-gray-900 p-2 rounded text-xs font-mono">
              {generatedHashes.map((h, i) => (
                <div key={i} className="text-green-400 truncate">
                  {h}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-yellow-500">
            Important: Save the raw vouchers securely! You&apos;ll need to distribute them
            to people who will redeem them. Only the hashes are stored on-chain.
          </p>
        </div>
      )}
    </div>
  );
}
