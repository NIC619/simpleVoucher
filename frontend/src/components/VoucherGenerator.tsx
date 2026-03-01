"use client";

import { useState } from "react";
import { keccak256, toHex, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface VoucherGeneratorProps {
  onUseVouchers: (rawVouchers: string[]) => void;
  voucherType?: "basic" | "binding";
}

export function VoucherGenerator({ onUseVouchers, voucherType = "basic" }: VoucherGeneratorProps) {
  const [count, setCount] = useState(5);
  const [generatedVouchers, setGeneratedVouchers] = useState<string[]>([]);
  const [generatedHashes, setGeneratedHashes] = useState<string[]>([]);
  const [copied, setCopied] = useState<"vouchers" | "hashes" | null>(null);

  const generateVouchers = () => {
    const vouchers: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < count; i++) {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const voucher = toHex(randomBytes);
      vouchers.push(voucher);

      if (voucherType === "binding") {
        const account = privateKeyToAccount(voucher as `0x${string}`);
        const hash = keccak256(encodePacked(["address"], [account.address]));
        hashes.push(hash);
      } else {
        const hash = keccak256(voucher);
        hashes.push(hash);
      }
    }

    setGeneratedVouchers(vouchers);
    setGeneratedHashes(hashes);
  };

  const copyToClipboard = async (items: string[], type: "vouchers" | "hashes") => {
    await navigator.clipboard.writeText(items.join("\n"));
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const useVouchers = () => {
    onUseVouchers(generatedVouchers);
  };

  return (
    <div className="p-4 border border-line rounded-[var(--radius)] bg-surface">
      <h3 className="text-base font-semibold mb-4">Voucher Generator</h3>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-muted">Number of vouchers:</label>
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-20 px-2 py-1 text-sm"
        />
        <button
          onClick={generateVouchers}
          className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-[var(--radius)] transition-colors"
        >
          Generate
        </button>
      </div>

      {generatedVouchers.length > 0 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {voucherType === "binding" ? "Private Keys" : "Raw Vouchers"}{" "}
                <span className="text-muted font-normal">(distribute to redeemers)</span>
              </span>
              <button
                onClick={() => copyToClipboard(generatedVouchers, "vouchers")}
                className="text-xs px-3 py-1 border border-line text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors"
              >
                {copied === "vouchers" ? "Copied!" : "Copy All"}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-surface-soft border border-line-soft rounded-[var(--radius)] p-2 text-xs font-mono">
              {generatedVouchers.map((v, i) => (
                <div key={i} className="text-[var(--text-muted)] truncate">
                  {v}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {voucherType === "binding" ? "Address Hashes" : "Voucher Hashes"}{" "}
                <span className="text-muted font-normal">(stored on-chain)</span>
              </span>
              <button
                onClick={() => copyToClipboard(generatedHashes, "hashes")}
                className="text-xs px-3 py-1 border border-line text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors"
              >
                {copied === "hashes" ? "Copied!" : "Copy All"}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-surface-soft border border-line-soft rounded-[var(--radius)] p-2 text-xs font-mono">
              {generatedHashes.map((h, i) => (
                <div key={i} className="text-accent truncate">
                  {h}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={useVouchers}
            className="w-full py-2 border border-accent text-accent hover:bg-surface-soft text-sm font-medium rounded-[var(--radius)] transition-colors"
          >
            Use These Vouchers
          </button>

          <p className="text-xs" style={{ color: "var(--warning-text)" }}>
            Save the {voucherType === "binding" ? "private keys" : "raw vouchers"} securely — distribute them to redeemers. Only hashes are stored on-chain.
          </p>
        </div>
      )}
    </div>
  );
}
