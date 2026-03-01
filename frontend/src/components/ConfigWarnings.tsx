"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import {
  SIMPLE_VOUCHER_ABI,
  SIMPLE_VOUCHER_ADDRESS,
  VOUCHER_BOARD_ABI,
  VOUCHER_BOARD_ADDRESS,
} from "@/config/contract";

interface ConfigWarning {
  type: "error" | "warning";
  message: string;
}

function validateAddress(address: string | undefined, name: string): ConfigWarning | null {
  if (!address) {
    return { type: "error", message: `${name} is not configured` };
  }
  if (!address.startsWith("0x")) {
    return { type: "error", message: `${name} must start with "0x"` };
  }
  if (address.length !== 42) {
    return { type: "error", message: `${name} must be 42 characters (got ${address.length})` };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { type: "error", message: `${name} contains invalid characters` };
  }
  return null;
}

export function ConfigWarnings() {
  const [hasPimlicoKey, setHasPimlicoKey] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setHasPimlicoKey(data.hasPimlicoKey))
      .catch(() => setHasPimlicoKey(false));
  }, []);

  const warnings: ConfigWarning[] = [];

  const chain = process.env.NEXT_PUBLIC_CHAIN;
  const validChains = ["mainnet", "sepolia", "base", "base-sepolia"];
  if (chain && !validChains.includes(chain)) {
    warnings.push({
      type: "warning",
      message: `NEXT_PUBLIC_CHAIN="${chain}" is not recognized. Valid values: ${validChains.join(", ")}`,
    });
  }

  const voucherAddressWarning = validateAddress(SIMPLE_VOUCHER_ADDRESS, "NEXT_PUBLIC_SIMPLE_VOUCHER_ADDRESS");
  if (voucherAddressWarning) warnings.push(voucherAddressWarning);

  const boardAddressWarning = validateAddress(VOUCHER_BOARD_ADDRESS, "NEXT_PUBLIC_VOUCHER_BOARD_ADDRESS");
  if (boardAddressWarning) {
    warnings.push({ ...boardAddressWarning, type: "warning" });
  }

  if (hasPimlicoKey === false) {
    warnings.push({
      type: "warning",
      message: "PIMLICO_API_KEY is not configured (required for Post Message)",
    });
  }

  const isSimpleVoucherValid = !voucherAddressWarning && !!SIMPLE_VOUCHER_ADDRESS;
  const { isError: isSimpleVoucherError, isLoading: isSimpleVoucherLoading } = useReadContract({
    address: SIMPLE_VOUCHER_ADDRESS,
    abi: SIMPLE_VOUCHER_ABI,
    functionName: "getVoucherStatus",
    args: ["0x0000000000000000000000000000000000000000", "", "0x0000000000000000000000000000000000000000000000000000000000000000"],
    query: { enabled: isSimpleVoucherValid, retry: false },
  });

  const isBoardValid = !boardAddressWarning && !!VOUCHER_BOARD_ADDRESS;
  const { data: linkedVoucherAddress, isError: isBoardError, isLoading: isBoardLoading } = useReadContract({
    address: VOUCHER_BOARD_ADDRESS,
    abi: VOUCHER_BOARD_ABI,
    functionName: "simpleVoucher",
    query: { enabled: isBoardValid, retry: false },
  });

  if (isSimpleVoucherValid && !isSimpleVoucherLoading) {
    if (isSimpleVoucherError) {
      warnings.push({
        type: "error",
        message: `SimpleVoucher contract not found or invalid at ${SIMPLE_VOUCHER_ADDRESS?.slice(0, 10)}...`,
      });
    }
  }

  if (isBoardValid && !isBoardLoading) {
    if (isBoardError) {
      warnings.push({
        type: "warning",
        message: `VoucherBoard contract not found or invalid at ${VOUCHER_BOARD_ADDRESS?.slice(0, 10)}...`,
      });
    } else if (linkedVoucherAddress && SIMPLE_VOUCHER_ADDRESS) {
      if (linkedVoucherAddress.toLowerCase() !== SIMPLE_VOUCHER_ADDRESS.toLowerCase()) {
        warnings.push({
          type: "warning",
          message: `VoucherBoard is linked to a different SimpleVoucher (${(linkedVoucherAddress as string).slice(0, 10)}...)`,
        });
      }
    }
  }

  if (warnings.length === 0) return null;

  const errors = warnings.filter((w) => w.type === "error");
  const warningsOnly = warnings.filter((w) => w.type === "warning");

  return (
    <div className="space-y-2 mb-6">
      {errors.length > 0 && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}
        >
          <p className="font-medium mb-2">Configuration Error</p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Check your <code>.env.local</code> file
          </p>
        </div>
      )}
      {warningsOnly.length > 0 && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}
        >
          <p className="font-medium mb-2">Configuration Warnings</p>
          <ul className="list-disc list-inside space-y-1">
            {warningsOnly.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
