"use client";

import { useState, useMemo } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS } from "@/config/contract";
import { targetChain } from "@/config/wagmi";
import { VoucherGenerator } from "./VoucherGenerator";

type VoucherType = "basic" | "binding";
type UseCase = "post" | "claim";

const useCaseConfig: Record<UseCase, { label: string; description: string; urlPrefix: string }> = {
  post: {
    label: "Post Message",
    description: "Anonymous posting — voucher holder can post a message to the bulletin board",
    urlPrefix: "/post",
  },
  claim: {
    label: "Claim Token",
    description: "Token claim — binding voucher holder can claim ERC20 tokens to their address",
    urlPrefix: "/claim",
  },
};

const toggleBtn = (active: boolean, disabled = false) =>
  `flex-1 py-2 px-4 text-sm font-medium border rounded-[var(--radius)] transition-colors ${
    active
      ? "border-accent text-accent bg-surface"
      : "border-line text-muted bg-surface hover:border-[var(--text-muted)]"
  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`;

const statusBanner = (type: "success" | "warning" | "error" | "info") => ({
  style: {
    background: `var(--${type}-bg)`,
    borderColor: `var(--${type}-border)`,
    color: `var(--${type}-text)`,
  },
  className: "p-3 border rounded-[var(--radius)] text-sm",
});

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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const currentConfig = useCaseConfig[useCase];

  const redeemUrl =
    isSuccess && address && submittedTopic
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

  const parseVouchers = (input: string): `0x${string}`[] => {
    return input
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => (v.startsWith("0x") ? v : `0x${v}`) as `0x${string}`);
  };

  const { vouchers, voucherHashes } = useMemo(() => {
    const vouchers = parseVouchers(vouchersInput);
    const voucherHashes = vouchers.map((v) => {
      if (voucherType === "binding") {
        const account = privateKeyToAccount(v as `0x${string}`);
        return keccak256(encodePacked(["address"], [account.address]));
      }
      return keccak256(v);
    });
    return { vouchers, voucherHashes };
  }, [vouchersInput, voucherType]);

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
      <div className="flex gap-3">
        <button
          onClick={() => setVoucherType("basic")}
          disabled={useCase === "claim"}
          className={toggleBtn(voucherType === "basic", useCase === "claim")}
        >
          Basic Voucher
        </button>
        <button
          onClick={() => setVoucherType("binding")}
          className={toggleBtn(voucherType === "binding")}
        >
          Binding Voucher
        </button>
      </div>

      {/* Use Case Selection */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Voucher Use Case</label>
        <div className="flex gap-3">
          {(Object.keys(useCaseConfig) as UseCase[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setUseCase(key);
                if (key === "claim") setVoucherType("binding");
              }}
              className={toggleBtn(useCase === key)}
            >
              {useCaseConfig[key].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-sm text-muted">{currentConfig.description}</p>
      </div>

      {/* Issue Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., event-2024, promotion-summer"
            className="w-full px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            {voucherType === "binding" ? "Private Keys" : "Vouchers"}{" "}
            <span className="text-muted font-normal">(one per line or comma-separated)</span>
          </label>
          <textarea
            value={vouchersInput}
            onChange={(e) => setVouchersInput(e.target.value)}
            placeholder="0x1234...abcd&#10;0x5678...efgh"
            rows={4}
            className="w-full px-3 py-2 font-mono text-sm"
            required
          />
          <p className="mt-1 text-xs text-muted">
            {vouchers.length} {voucherType === "binding" ? "private key(s)" : "voucher(s)"} — share raw values with redeemers
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            {voucherType === "binding" ? "Address Hashes" : "Voucher Hashes"}{" "}
            <span className="text-muted font-normal">(auto-computed, stored on-chain)</span>
          </label>
          <textarea
            value={voucherHashes.join("\n")}
            readOnly
            rows={4}
            className="w-full px-3 py-2 font-mono text-sm text-muted"
            placeholder="Hashes will appear here..."
          />
        </div>

        {/* URL Preview */}
        {isConnected && topic && (
          <div className="p-4 bg-surface border border-line rounded-[var(--radius)] space-y-3">
            <h3 className="text-sm font-medium">{currentConfig.label} Link Preview</h3>

            {vouchers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted">Share these links with voucher holders:</p>
                  {vouchers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allUrls = vouchers
                          .map(
                            (v) =>
                              `${typeof window !== "undefined" ? window.location.origin : ""}${currentConfig.urlPrefix}/${address}/${encodeURIComponent(topic)}/${v}`
                          )
                          .join("\n");
                        copyPreviewUrl(allUrls, "all");
                      }}
                      className="px-3 py-1 text-xs font-medium border border-line text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors"
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
                        <code className="flex-1 p-2 bg-surface-soft border border-line-soft rounded text-xs break-all text-accent" style={{ fontFamily: "var(--font-mono)" }}>
                          {fullUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyPreviewUrl(fullUrl, `voucher-${i}`)}
                          className="px-3 py-1.5 text-xs font-medium border border-line text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors whitespace-nowrap"
                        >
                          {copiedPreviewUrl === `voucher-${i}` ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted mt-2">
                  {vouchers.length} {currentConfig.label.toLowerCase()} link(s)
                </p>
              </div>
            )}

            {vouchers.length === 0 && (
              <p className="text-sm text-muted">Enter vouchers above to see preview links</p>
            )}
          </div>
        )}

        {!isConnected ? (
          <p className="text-sm" style={{ color: "var(--warning-text)" }}>
            Please connect your wallet to issue vouchers
          </p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming || !topic || vouchers.length === 0}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending
              ? "Confirm in Wallet..."
              : isConfirming
              ? "Confirming..."
              : "Issue Vouchers"}
          </button>
        )}

        {error && (
          <div {...statusBanner("error")}>
            Error: {error.message}
          </div>
        )}

        {isSuccess && (
          <div
            className="p-4 border rounded-[var(--radius)] text-sm space-y-3"
            style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
          >
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
              <div className="pt-3 border-t" style={{ borderColor: "var(--success-border)" }}>
                <p className="mb-2">Share this redeem link with voucher holders:</p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 p-2 bg-surface-soft border border-line-soft rounded text-xs break-all text-accent"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {redeemUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyRedeemUrl}
                    className="px-3 py-1.5 text-xs font-medium border border-line text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors whitespace-nowrap"
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
      <VoucherGenerator onUseVouchers={handleUseVouchers} voucherType={voucherType} />
    </div>
  );
}
