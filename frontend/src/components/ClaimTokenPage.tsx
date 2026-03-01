"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS, TOKEN_CLAIM_ABI, TOKEN_CLAIM_ADDRESS } from "@/config/contract";
import { targetChain } from "@/config/wagmi";

type VoucherStatus = 0 | 1 | 2;

interface ClaimTokenPageProps {
  prefillIssuer?: string;
  prefillTopic?: string;
  prefillVoucher?: string;
}

export function ClaimTokenPage({ prefillIssuer, prefillTopic, prefillVoucher }: ClaimTokenPageProps) {
  const [urlMode, setUrlMode] = useState(!!prefillIssuer);
  const [voucherUrl, setVoucherUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [issuer, setIssuer] = useState(prefillIssuer || "");
  const [topic, setTopic] = useState(prefillTopic || "");
  const [voucherPrivateKey, setVoucherPrivateKey] = useState(prefillVoucher || "");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [checkTriggered, setCheckTriggered] = useState(false);

  const { address: connectedAddress } = useAccount();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (connectedAddress && !recipientAddress) {
      setRecipientAddress(connectedAddress);
    }
  }, [connectedAddress, recipientAddress]);

  const voucherHash = useMemo(() => {
    if (!voucherPrivateKey) return null;
    try {
      const pk = (voucherPrivateKey.startsWith("0x") ? voucherPrivateKey : `0x${voucherPrivateKey}`) as `0x${string}`;
      const account = privateKeyToAccount(pk);
      return keccak256(encodePacked(["address"], [account.address]));
    } catch {
      return null;
    }
  }, [voucherPrivateKey]);

  const shouldCheck = checkTriggered && issuer && topic && voucherHash && SIMPLE_VOUCHER_ADDRESS;

  const { data: statusData, isLoading: isChecking, error: checkError, refetch } = useReadContract({
    address: SIMPLE_VOUCHER_ADDRESS,
    abi: SIMPLE_VOUCHER_ABI,
    functionName: "getVoucherStatus",
    args: shouldCheck ? [issuer as `0x${string}`, topic, voucherHash] : undefined,
    query: { enabled: !!shouldCheck },
  });

  const voucherStatus = statusData as VoucherStatus | undefined;

  useEffect(() => {
    if (prefillIssuer) setIssuer(prefillIssuer);
    if (prefillTopic) setTopic(prefillTopic);
    if (prefillVoucher) {
      setVoucherPrivateKey(prefillVoucher);
      setCheckTriggered(true);
    }
  }, [prefillIssuer, prefillTopic, prefillVoucher]);

  useEffect(() => {
    if (!prefillVoucher) {
      setCheckTriggered(false);
    }
  }, [issuer, topic, voucherPrivateKey, prefillVoucher]);

  const parseVoucherUrl = (url: string): { issuer: string; topic: string; voucher: string } | null => {
    try {
      let pathname: string;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        pathname = new URL(url).pathname;
      } else if (url.startsWith("/")) {
        pathname = url;
      } else {
        pathname = "/" + url;
      }

      let parts = pathname.slice(1).split("/").filter(Boolean);
      if (parts.length > 0 && (parts[0] === "claim" || parts[0] === "redeem" || parts[0] === "post")) {
        parts = parts.slice(1);
      }
      if (parts.length < 3) return null;

      const [issuerPart, topicPart, voucherPart] = parts;
      if (!issuerPart.startsWith("0x") || issuerPart.length !== 42) return null;

      return {
        issuer: issuerPart,
        topic: decodeURIComponent(topicPart),
        voucher: decodeURIComponent(voucherPart),
      };
    } catch {
      return null;
    }
  };

  const handleUrlChange = (url: string) => {
    setVoucherUrl(url);
    setUrlError(null);
    if (!url.trim()) return;

    const parsed = parseVoucherUrl(url);
    if (parsed) {
      setIssuer(parsed.issuer);
      setTopic(parsed.topic);
      setVoucherPrivateKey(parsed.voucher);
      setCheckTriggered(true);
      setUrlMode(true);
    } else {
      setUrlError("Invalid claim URL format. Expected: /claim/{issuer}/{topic}/{privateKey}");
    }
  };

  const handleCheckVoucher = () => {
    setCheckTriggered(true);
    refetch();
  };

  const handleClaim = async () => {
    if (!issuer || !topic || !voucherPrivateKey || !recipientAddress || !TOKEN_CLAIM_ADDRESS) return;

    try {
      const pk = (voucherPrivateKey.startsWith("0x") ? voucherPrivateKey : `0x${voucherPrivateKey}`) as `0x${string}`;
      const account = privateKeyToAccount(pk);
      const digest = keccak256(encodePacked(["address"], [recipientAddress as `0x${string}`]));
      const sig = await account.sign({ hash: digest });

      writeContract({
        address: TOKEN_CLAIM_ADDRESS,
        abi: TOKEN_CLAIM_ABI,
        functionName: "claimToken",
        args: [issuer as `0x${string}`, topic, recipientAddress as `0x${string}`, sig],
        gas: BigInt(500_000),
      });
    } catch (err) {
      console.error("Claim error:", err);
    }
  };

  const getStatusMessage = () => {
    if (isChecking) return { type: "info" as const, message: "Checking voucher status..." };
    if (checkError) return { type: "error" as const, message: "Failed to check voucher status" };
    if (voucherStatus === undefined) return null;

    switch (voucherStatus) {
      case 0: return { type: "error" as const, message: "Voucher does not exist or invalid issuer/topic" };
      case 1: return { type: "success" as const, message: "Voucher is valid and can be used to claim tokens" };
      case 2: return { type: "warning" as const, message: "Voucher has already been redeemed" };
      default: return null;
    }
  };

  const statusMessage = checkTriggered ? getStatusMessage() : null;
  const canClaim = voucherStatus === 1 && recipientAddress && !isPending && !isConfirming;

  const renderStatusBanners = () => (
    <>
      {statusMessage && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{
            background: `var(--${statusMessage.type}-bg)`,
            borderColor: `var(--${statusMessage.type}-border)`,
            color: `var(--${statusMessage.type}-text)`,
          }}
        >
          {statusMessage.message}
        </div>
      )}

      {isSuccess && (
        <div
          className="p-4 border rounded-[var(--radius)] text-sm space-y-3"
          style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
        >
          <p className="font-medium">Tokens claimed successfully!</p>
          <p>Tokens have been sent to {recipientAddress}</p>
          {hash && targetChain.blockExplorers?.default && (
            <a
              href={`${targetChain.blockExplorers.default.url}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline block"
            >
              View transaction on {targetChain.blockExplorers.default.name}
            </a>
          )}
        </div>
      )}

      {writeError && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}
        >
          <p className="font-medium">Error claiming tokens</p>
          <p className="mt-1 break-all">{writeError.message}</p>
        </div>
      )}
    </>
  );

  const renderRecipientAndClaim = () => (
    <>
      {voucherStatus === 1 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Recipient Address</label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x... (auto-filled from connected wallet)"
            className="w-full px-3 py-2 font-mono"
            disabled={isPending || isConfirming}
          />
          <p className="mt-1 text-xs text-muted">
            {connectedAddress
              ? "Auto-filled from your connected wallet. You can change it."
              : "Connect your wallet to auto-fill, or enter an address manually."}
          </p>
        </div>
      )}

      {voucherStatus === 1 && recipientAddress && !isSuccess && (
        <button
          type="button"
          onClick={handleClaim}
          disabled={!canClaim}
          className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Confirm in Wallet..." : isConfirming ? "Confirming..." : "Claim Tokens"}
        </button>
      )}
    </>
  );

  // URL mode (from route or pasted URL)
  if (urlMode) {
    return (
      <div className="space-y-6">
        {renderStatusBanners()}

        {!isSuccess && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Issuer Address</label>
              <div className="w-full px-3 py-2 bg-surface-soft border border-line rounded-[var(--radius)] text-sm font-mono break-all text-muted">
                {issuer}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Topic</label>
              <div className="w-full px-3 py-2 bg-surface-soft border border-line rounded-[var(--radius)] text-sm text-muted">
                {topic}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Voucher <span className="text-muted font-normal">(private key)</span></label>
              <div className="w-full px-3 py-2 bg-surface-soft border border-line rounded-[var(--radius)] text-sm font-mono break-all text-muted">
                {voucherPrivateKey.slice(0, 10)}...{voucherPrivateKey.slice(-8)}
              </div>
              <p className="mt-1 text-xs text-muted">Your voucher will be consumed after claiming</p>
            </div>

            {renderRecipientAndClaim()}
          </div>
        )}
      </div>
    );
  }

  // Manual mode (Claim Token tab)
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div
        className="p-3 border rounded-[var(--radius)] text-sm"
        style={{ background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--info-text)" }}
      >
        <p className="font-medium mb-1">Claim Tokens</p>
        <p>Use a binding voucher to claim ERC20 tokens. The voucher&apos;s private key signs your recipient address to authorize the claim.</p>
      </div>

      {renderStatusBanners()}

      {!isSuccess && (
        <div className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Claim URL <span className="text-muted font-normal">(paste to auto-fill)</span></label>
            <input
              type="text"
              value={voucherUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/claim/0x.../topic/privateKey"
              className="w-full px-3 py-2 font-mono text-sm"
              disabled={isPending || isConfirming}
            />
            {urlError && <p className="mt-1 text-sm" style={{ color: "var(--error-text)" }}>{urlError}</p>}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-bg text-muted">or fill manually</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Issuer Address</label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 font-mono"
              disabled={isPending || isConfirming}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., event-2024"
              className="w-full px-3 py-2"
              disabled={isPending || isConfirming}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Voucher Private Key</label>
            <input
              type="text"
              value={voucherPrivateKey}
              onChange={(e) => setVoucherPrivateKey(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 font-mono"
              disabled={isPending || isConfirming}
              required
            />
            <p className="mt-1 text-xs text-muted">Your voucher will be consumed after claiming</p>
          </div>

          {issuer && topic && voucherPrivateKey && !checkTriggered && (
            <button
              type="button"
              onClick={handleCheckVoucher}
              disabled={isChecking || isPending || isConfirming}
              className="w-full py-2 px-4 border border-line text-sm font-medium text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isChecking ? "Checking..." : "Check Voucher Validity"}
            </button>
          )}

          {renderRecipientAndClaim()}
        </div>
      )}
    </div>
  );
}
