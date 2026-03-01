"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { keccak256, Hex } from "viem";
import { SIMPLE_VOUCHER_ABI, SIMPLE_VOUCHER_ADDRESS, VOUCHER_BOARD_ADDRESS } from "@/config/contract";
import { postMessageViaUserOp } from "@/lib/erc4337";
import { targetChain } from "@/config/wagmi";
import { MessageBoard } from "./MessageBoard";

// Status enum from contract: 0 = Nonexist, 1 = Issued, 2 = Redeemed
type VoucherStatus = 0 | 1 | 2;

interface PostMessagePageProps {
  prefillIssuer?: string;
  prefillTopic?: string;
  prefillVoucher?: string;
}

export function PostMessagePage({ prefillIssuer, prefillTopic, prefillVoucher }: PostMessagePageProps) {
  const [urlMode, setUrlMode] = useState(!!prefillIssuer);
  const [voucherUrl, setVoucherUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [issuer, setIssuer] = useState(prefillIssuer || "");
  const [topic, setTopic] = useState(prefillTopic || "");
  const [voucher, setVoucher] = useState(prefillVoucher || "");
  const [message, setMessage] = useState("");
  const [checkTriggered, setCheckTriggered] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<string>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPimlicoKey, setHasPimlicoKey] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setHasPimlicoKey(data.hasPimlicoKey))
      .catch(() => setHasPimlicoKey(false));
  }, []);

  const parseVoucherUrl = (url: string): { issuer: string; topic: string; voucher: string } | null => {
    try {
      let pathname: string;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const urlObj = new URL(url);
        pathname = urlObj.pathname;
      } else if (url.startsWith("/")) {
        pathname = url;
      } else {
        pathname = "/" + url;
      }

      let parts = pathname.slice(1).split("/").filter(Boolean);

      if (parts.length > 0 && (parts[0] === "redeem" || parts[0] === "post")) {
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
      setVoucher(parsed.voucher);
      setCheckTriggered(true);
      setUrlMode(true);
    } else {
      setUrlError("Invalid voucher URL format. Expected: /{issuer}/{topic}/{voucher}");
    }
  };

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

  const handlePostMessage = async () => {
    if (!issuer || !topic || !voucher || !message) return;

    setIsPosting(true);
    setPostStatus("Starting...");
    setErrorMessage(null);
    setTxHash(null);

    try {
      const voucherValue = (voucher.startsWith("0x") ? voucher : `0x${voucher}`) as Hex;

      const result = await postMessageViaUserOp({
        issuer: issuer as `0x${string}`,
        topic,
        voucher: voucherValue,
        message,
        onStatusChange: setPostStatus,
      });

      if (result.success) {
        setPostStatus("success");
        setTxHash(result.transactionHash || null);
      } else {
        throw new Error("UserOp execution failed");
      }
    } catch (error) {
      console.error("Post message error:", error);
      setPostStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsPosting(false);
    }
  };

  const handleReset = () => {
    setMessage("");
    setPostStatus("idle");
    setTxHash(null);
    setErrorMessage(null);
    setCheckTriggered(false);
  };

  const getStatusMessage = () => {
    if (isChecking) return { type: "info" as const, message: "Checking voucher status..." };
    if (checkError) return { type: "error" as const, message: "Failed to check voucher status" };
    if (voucherStatus === undefined) return null;

    switch (voucherStatus) {
      case 0: return { type: "error" as const, message: "Voucher does not exist or invalid issuer/topic" };
      case 1: return { type: "success" as const, message: "Voucher is valid and can be used to post" };
      case 2: return { type: "warning" as const, message: "Voucher has already been redeemed" };
      default: return null;
    }
  };

  const statusMessage = checkTriggered ? getStatusMessage() : null;
  const canPost = voucherStatus === 1 && message.length > 0 && !isPosting;

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

      {postStatus === "success" && (
        <div
          className="p-4 border rounded-[var(--radius)] text-sm space-y-3"
          style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
        >
          <p className="font-medium">Message posted successfully!</p>
          <p>Your message has been posted anonymously to the bulletin board.</p>
          {txHash && targetChain.blockExplorers?.default && (
            <a
              href={`${targetChain.blockExplorers.default.url}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline block"
            >
              View transaction on {targetChain.blockExplorers.default.name}
            </a>
          )}
          <button
            onClick={handleReset}
            className="text-sm px-3 py-1 border rounded-[var(--radius)] transition-colors"
            style={{ borderColor: "var(--success-border)" }}
          >
            Post Another Message
          </button>
        </div>
      )}

      {postStatus === "error" && errorMessage && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}
        >
          <p className="font-medium">Error posting message</p>
          <p className="mt-1 break-all">{errorMessage}</p>
        </div>
      )}

      {isPosting && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--info-text)" }}
        >
          <p className="font-medium">{postStatus}</p>
        </div>
      )}
    </>
  );

  const renderMessageInput = () => (
    <>
      {voucherStatus === 1 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Your Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your anonymous message..."
            rows={4}
            className="w-full px-3 py-2"
            disabled={isPosting}
            required
          />
          <p className="mt-1 text-xs text-muted">{message.length} characters</p>
        </div>
      )}

      {voucherStatus === 1 && message.length > 0 && (
        hasPimlicoKey ? (
          <button
            type="button"
            onClick={handlePostMessage}
            disabled={!canPost}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPosting ? postStatus : "Post Message Anonymously"}
          </button>
        ) : (
          <div
            className="p-4 border rounded-[var(--radius)] text-sm space-y-3"
            style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}
          >
            <p className="font-medium">Pimlico API Key Required</p>
            <p>
              To post messages via ERC-4337, configure{" "}
              <code>PIMLICO_API_KEY</code> in your <code>.env.local</code> file.
            </p>
            <p>
              Get a free API key at{" "}
              <a href="https://dashboard.pimlico.io" target="_blank" rel="noopener noreferrer" className="underline">
                dashboard.pimlico.io
              </a>
            </p>
            <div className="pt-2 border-t" style={{ borderColor: "var(--warning-border)" }}>
              <p className="text-xs text-muted mb-2">VoucherBoard contract:</p>
              <code className="block p-2 bg-surface-soft rounded text-xs font-mono break-all border border-line-soft">
                {VOUCHER_BOARD_ADDRESS}
              </code>
            </div>
          </div>
        )
      )}
    </>
  );

  // Simplified view: URL mode (from URL route or pasted URL)
  if (urlMode) {
    return (
      <div className="space-y-6">
        {renderStatusBanners()}

        {postStatus !== "success" && (
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
              <label className="block text-sm font-medium mb-1.5">Voucher <span className="text-muted font-normal">(raw value)</span></label>
              <div className="w-full px-3 py-2 bg-surface-soft border border-line rounded-[var(--radius)] text-sm font-mono break-all text-muted">
                {voucher}
              </div>
              <p className="mt-1 text-xs text-muted">Your voucher will be consumed after posting</p>
            </div>

            {renderMessageInput()}
          </div>
        )}
      </div>
    );
  }

  // Full view: manual mode (Post Message tab)
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div
        className="p-3 border rounded-[var(--radius)] text-sm"
        style={{ background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--info-text)" }}
      >
        <p className="font-medium mb-1">Anonymous Bulletin Board</p>
        <p>Post messages using your voucher. Your identity remains hidden as you do not send any transaction from your account.</p>
      </div>

      {renderStatusBanners()}

      {postStatus !== "success" && (
        <div className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Voucher URL <span className="text-muted font-normal">(paste to auto-fill)</span></label>
            <input
              type="text"
              value={voucherUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/0x.../topic/voucher"
              className="w-full px-3 py-2 font-mono text-sm"
              disabled={isPosting}
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
              disabled={isPosting}
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
              disabled={isPosting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Voucher <span className="text-muted font-normal">(raw value)</span></label>
            <input
              type="text"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 font-mono"
              disabled={isPosting}
              required
            />
            <p className="mt-1 text-xs text-muted">Your voucher will be consumed after posting</p>
          </div>

          {issuer && topic && voucher && !checkTriggered && (
            <button
              type="button"
              onClick={handleCheckVoucher}
              disabled={isChecking || isPosting}
              className="w-full py-2 px-4 border border-line text-sm font-medium text-muted hover:border-accent hover:text-accent rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isChecking ? "Checking..." : "Check Voucher Validity"}
            </button>
          )}

          {renderMessageInput()}
        </div>
      )}

      {/* Message Board */}
      <MessageBoard defaultIssuer={issuer} defaultTopic={topic} />
    </div>
  );
}
