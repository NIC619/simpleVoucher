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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
      setVoucher(prefillVoucher);
      setCheckTriggered(true);
    }
  }, [prefillIssuer, prefillTopic, prefillVoucher]);

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
    if (isChecking) return { type: "info" as const, message: "Checking voucher status..." };
    if (checkError) return { type: "error" as const, message: "Failed to check voucher status" };
    if (voucherStatus === undefined) return null;

    switch (voucherStatus) {
      case 0: return { type: "error" as const, message: "Voucher does not exist or invalid issuer/topic" };
      case 1: return { type: "success" as const, message: "Voucher is valid and can be redeemed" };
      case 2: return { type: "warning" as const, message: "Voucher has already been redeemed" };
      default: return null;
    }
  };

  const statusMessage = checkTriggered ? getStatusMessage() : null;

  return (
    <div className="space-y-6">
      {(prefillIssuer || prefillTopic || prefillVoucher) && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--info-text)" }}
        >
          Redeeming voucher from issuer{" "}
          <span className="font-mono">{prefillIssuer?.slice(0, 6)}...{prefillIssuer?.slice(-4)}</span>
          {prefillTopic && (
            <> under topic <span className="font-semibold">&quot;{prefillTopic}&quot;</span></>
          )}
        </div>
      )}

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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Issuer Address</label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 font-mono"
            required
            readOnly={!!prefillIssuer}
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
            required
            readOnly={!!prefillTopic}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Voucher <span className="text-muted font-normal">(raw value, not hash)</span></label>
          <input
            type="text"
            value={voucher}
            onChange={(e) => setVoucher(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 font-mono"
            required
            readOnly={!!prefillVoucher}
          />
          <p className="mt-1 text-xs text-muted">Enter the raw voucher value you received from the issuer</p>
        </div>

        {!prefillVoucher && issuer && topic && voucher && (
          <button
            type="button"
            onClick={handleCheckVoucher}
            disabled={isChecking}
            className="w-full py-2 px-4 border border-line text-sm font-medium text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isChecking ? "Checking..." : "Check Voucher Validity"}
          </button>
        )}

        {!isConnected ? (
          <p className="text-sm" style={{ color: "var(--warning-text)" }}>
            Please connect your wallet to redeem
          </p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming || !issuer || !topic || !voucher || voucherStatus === 0 || voucherStatus === 2}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "Confirm in Wallet..." : isConfirming ? "Confirming..." : "Redeem Voucher"}
          </button>
        )}

        {error && (
          <div
            className="p-3 border rounded-[var(--radius)] text-sm"
            style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}
          >
            Error: {error.message}
          </div>
        )}

        {isSuccess && (
          <div
            className="p-3 border rounded-[var(--radius)] text-sm space-y-2"
            style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
          >
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
              className="text-sm px-3 py-1 border rounded-[var(--radius)] transition-colors"
              style={{ borderColor: "var(--success-border)" }}
            >
              Redeem Another
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
