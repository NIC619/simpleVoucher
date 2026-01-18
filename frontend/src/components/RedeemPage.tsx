"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { keccak256 } from "viem";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS } from "@/config/contract";

// Status enum from contract: 0 = Nonexist, 1 = Issued, 2 = Redeemed
type VoucherStatus = 0 | 1 | 2;

interface RedeemPageProps {
  prefillIssuer?: string;
  prefillTopic?: string;
  prefillVoucher?: string;
}

export function RedeemPage({ prefillIssuer, prefillTopic, prefillVoucher }: RedeemPageProps) {
  const [issuer, setIssuer] = useState(prefillIssuer || "");
  const [topic, setTopic] = useState(prefillTopic || "");
  const [voucher, setVoucher] = useState(prefillVoucher || "");
  const [checkTriggered, setCheckTriggered] = useState(false);
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Compute voucher hash for checking status
  const getVoucherHash = (v: string): `0x${string}` | null => {
    if (!v) return null;
    const voucherValue = v.startsWith("0x") ? v : `0x${v}`;
    try {
      return keccak256(voucherValue as `0x${string}`);
    } catch {
      return null;
    }
  };

  const voucherHash = getVoucherHash(voucher);

  // Check voucher status
  const shouldCheck = checkTriggered && issuer && topic && voucherHash && SIMPLE_VOUCHER_ADDRESS;

  const { data: statusData, isLoading: isChecking, error: checkError, refetch } = useReadContract({
    address: SIMPLE_VOUCHER_ADDRESS,
    abi: SIMPLE_VOUCHER_ABI,
    functionName: "getVoucherStatus",
    args: shouldCheck ? [issuer as `0x${string}`, topic, voucherHash] : undefined,
    query: {
      enabled: !!shouldCheck,
    },
  });

  const voucherStatus = statusData as VoucherStatus | undefined;

  // Auto-check when prefilled voucher is provided
  useEffect(() => {
    if (prefillIssuer) setIssuer(prefillIssuer);
    if (prefillTopic) setTopic(prefillTopic);
    if (prefillVoucher) {
      setVoucher(prefillVoucher);
      setCheckTriggered(true);
    }
  }, [prefillIssuer, prefillTopic, prefillVoucher]);

  // Reset check when inputs change (for manual input)
  useEffect(() => {
    if (!prefillVoucher) {
      setCheckTriggered(false);
    }
  }, [issuer, topic, voucher, prefillVoucher]);

  const handleCheckVoucher = () => {
    setCheckTriggered(true);
    refetch();
  };

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
    setCheckTriggered(false);
  };

  const getStatusMessage = () => {
    if (isChecking) return { type: "loading", message: "Checking voucher status..." };
    if (checkError) return { type: "error", message: "Failed to check voucher status" };
    if (voucherStatus === undefined) return null;

    switch (voucherStatus) {
      case 0:
        return { type: "error", message: "Voucher does not exist or invalid issuer/topic" };
      case 1:
        return { type: "success", message: "Voucher is valid and can be redeemed" };
      case 2:
        return { type: "warning", message: "Voucher has already been redeemed" };
      default:
        return null;
    }
  };

  const statusMessage = checkTriggered ? getStatusMessage() : null;

  return (
    <div className="space-y-6">
      {(prefillIssuer || prefillTopic || prefillVoucher) && (
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

      {/* Voucher Status Message */}
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
            readOnly={!!prefillVoucher}
          />
          <p className="mt-1 text-sm text-gray-400">
            Enter the raw voucher value you received from the issuer
          </p>
        </div>

        {/* Check Voucher Button (for manual input) */}
        {!prefillVoucher && issuer && topic && voucher && (
          <button
            type="button"
            onClick={handleCheckVoucher}
            disabled={isChecking}
            className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors text-sm"
          >
            {isChecking ? "Checking..." : "Check Voucher Validity"}
          </button>
        )}

        {!isConnected ? (
          <p className="text-yellow-500">Please connect your wallet to redeem</p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming || !issuer || !topic || !voucher || voucherStatus === 0 || voucherStatus === 2}
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
