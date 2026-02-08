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

  // Auto-fill recipient from connected wallet
  useEffect(() => {
    if (connectedAddress && !recipientAddress) {
      setRecipientAddress(connectedAddress);
    }
  }, [connectedAddress, recipientAddress]);

  // Derive voucher address hash from private key for status check
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

  // Check voucher status
  const shouldCheck = checkTriggered && issuer && topic && voucherHash && SIMPLE_VOUCHER_ADDRESS;

  const { data: statusData, isLoading: isChecking, error: checkError, refetch } = useReadContract({
    address: SIMPLE_VOUCHER_ADDRESS,
    abi: SIMPLE_VOUCHER_ABI,
    functionName: "getVoucherStatus",
    args: shouldCheck ? [issuer as `0x${string}`, topic, voucherHash] : undefined,
    query: { enabled: !!shouldCheck },
  });

  const voucherStatus = statusData as VoucherStatus | undefined;

  // Auto-check when prefilled
  useEffect(() => {
    if (prefillIssuer) setIssuer(prefillIssuer);
    if (prefillTopic) setTopic(prefillTopic);
    if (prefillVoucher) {
      setVoucherPrivateKey(prefillVoucher);
      setCheckTriggered(true);
    }
  }, [prefillIssuer, prefillTopic, prefillVoucher]);

  // Reset check when inputs change (manual mode)
  useEffect(() => {
    if (!prefillVoucher) {
      setCheckTriggered(false);
    }
  }, [issuer, topic, voucherPrivateKey, prefillVoucher]);

  // Parse voucher URL
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
    if (isChecking) return { type: "loading", message: "Checking voucher status..." };
    if (checkError) return { type: "error", message: "Failed to check voucher status" };
    if (voucherStatus === undefined) return null;

    switch (voucherStatus) {
      case 0:
        return { type: "error", message: "Voucher does not exist or invalid issuer/topic" };
      case 1:
        return { type: "success", message: "Voucher is valid and can be used to claim tokens" };
      case 2:
        return { type: "warning", message: "Voucher has already been redeemed" };
      default:
        return null;
    }
  };

  const statusMessage = checkTriggered ? getStatusMessage() : null;
  const canClaim = voucherStatus === 1 && recipientAddress && !isPending && !isConfirming;

  const renderStatusBanners = () => (
    <>
      {statusMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          statusMessage.type === "success"
            ? "bg-green-900/50 border border-green-500 text-green-300"
            : statusMessage.type === "warning"
            ? "bg-yellow-900/50 border border-yellow-500 text-yellow-300"
            : statusMessage.type === "error"
            ? "bg-red-900/50 border border-red-500 text-red-300"
            : "bg-gray-800 text-gray-300"
        }`}>
          {statusMessage.message}
        </div>
      )}

      {isSuccess && (
        <div className="p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-300 space-y-3">
          <p className="font-medium">Tokens claimed successfully!</p>
          <p className="text-sm">Tokens have been sent to {recipientAddress}</p>
          {hash && targetChain.blockExplorers?.default && (
            <a
              href={`${targetChain.blockExplorers.default.url}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline block"
            >
              View transaction on {targetChain.blockExplorers.default.name}
            </a>
          )}
        </div>
      )}

      {writeError && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x... (auto-filled from connected wallet)"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
            disabled={isPending || isConfirming}
          />
          <p className="mt-1 text-sm text-gray-400">
            {connectedAddress ? "Auto-filled from your connected wallet. You can change it." : "Connect your wallet to auto-fill, or enter an address manually."}
          </p>
        </div>
      )}

      {voucherStatus === 1 && recipientAddress && !isSuccess && (
        <button
          type="button"
          onClick={handleClaim}
          disabled={!canClaim}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {isPending
            ? "Confirm in Wallet..."
            : isConfirming
            ? "Confirming..."
            : "Claim Tokens"}
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Issuer Address
              </label>
              <div className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 font-mono break-all">
                {issuer}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Topic
              </label>
              <div className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300">
                {topic}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Voucher (private key)
              </label>
              <div className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 font-mono break-all">
                {voucherPrivateKey.slice(0, 10)}...{voucherPrivateKey.slice(-8)}
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Your voucher will be consumed after claiming
              </p>
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
      <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm">
        <p className="font-medium mb-1">Claim Tokens</p>
        <p>Use a binding voucher to claim ERC20 tokens. The voucher&apos;s private key signs your recipient address to authorize the claim.</p>
      </div>

      {renderStatusBanners()}

      {!isSuccess && (
        <div className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Claim URL (paste to auto-fill)
            </label>
            <input
              type="text"
              value={voucherUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/claim/0x.../topic/privateKey"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
              disabled={isPending || isConfirming}
            />
            {urlError && (
              <p className="mt-1 text-sm text-red-400">{urlError}</p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">or fill manually</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Issuer Address
            </label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
              disabled={isPending || isConfirming}
              required
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
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isPending || isConfirming}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voucher Private Key
            </label>
            <input
              type="text"
              value={voucherPrivateKey}
              onChange={(e) => setVoucherPrivateKey(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
              disabled={isPending || isConfirming}
              required
            />
            <p className="mt-1 text-sm text-gray-400">
              Your voucher will be consumed after claiming
            </p>
          </div>

          {/* Check Voucher Button */}
          {issuer && topic && voucherPrivateKey && !checkTriggered && (
            <button
              type="button"
              onClick={handleCheckVoucher}
              disabled={isChecking || isPending || isConfirming}
              className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors text-sm"
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
