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
  // "url mode" = simplified view with read-only fields (entered via URL route or pasted URL)
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

  // Fetch server-side config (no secrets exposed)
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setHasPimlicoKey(data.hasPimlicoKey))
      .catch(() => setHasPimlicoKey(false));
  }, []);

  // Parse voucher URL to extract issuer, topic, and voucher
  // Supported formats:
  //   /redeem/{issuer}/{topic}/{voucher}
  //   /post/{issuer}/{topic}/{voucher}
  //   /{issuer}/{topic}/{voucher} (legacy)
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

      // Remove leading slash and split
      let parts = pathname.slice(1).split("/").filter(Boolean);

      // Skip "redeem" or "post" prefix if present
      if (parts.length > 0 && (parts[0] === "redeem" || parts[0] === "post")) {
        parts = parts.slice(1);
      }

      if (parts.length < 3) return null;

      const [issuerPart, topicPart, voucherPart] = parts;

      // Validate issuer looks like an address
      if (!issuerPart.startsWith("0x") || issuerPart.length !== 42) return null;

      // Decode URL-encoded parts
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

    if (!url.trim()) {
      return;
    }

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
    if (isChecking) return { type: "loading", message: "Checking voucher status..." };
    if (checkError) return { type: "error", message: "Failed to check voucher status" };
    if (voucherStatus === undefined) return null;

    switch (voucherStatus) {
      case 0:
        return { type: "error", message: "Voucher does not exist or invalid issuer/topic" };
      case 1:
        return { type: "success", message: "Voucher is valid and can be used to post" };
      case 2:
        return { type: "warning", message: "Voucher has already been redeemed" };
      default:
        return null;
    }
  };

  const statusMessage = checkTriggered ? getStatusMessage() : null;
  const canPost = voucherStatus === 1 && message.length > 0 && !isPosting;

  // Shared status/progress/success/error UI
  const renderStatusBanners = () => (
    <>
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

      {/* Success Message */}
      {postStatus === "success" && (
        <div className="p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-300 space-y-3">
          <p className="font-medium">Message posted successfully!</p>
          <p className="text-sm">Your message has been posted anonymously to the bulletin board.</p>
          {txHash && targetChain.blockExplorers?.default && (
            <a
              href={`${targetChain.blockExplorers.default.url}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline block"
            >
              View transaction on {targetChain.blockExplorers.default.name}
            </a>
          )}
          <button
            onClick={handleReset}
            className="text-sm px-3 py-1 bg-green-700 hover:bg-green-600 rounded transition-colors"
          >
            Post Another Message
          </button>
        </div>
      )}

      {/* Error Message */}
      {postStatus === "error" && errorMessage && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          <p className="font-medium">Error posting message</p>
          <p className="mt-1 break-all">{errorMessage}</p>
        </div>
      )}

      {/* Posting Progress */}
      {isPosting && (
        <div className="p-3 bg-purple-900/50 border border-purple-500 rounded-lg text-purple-300 text-sm">
          <p className="font-medium">{postStatus}</p>
        </div>
      )}
    </>
  );

  // Shared message input + post button UI
  const renderMessageInput = () => (
    <>
      {voucherStatus === 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your anonymous message..."
            rows={4}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            disabled={isPosting}
            required
          />
          <p className="mt-1 text-sm text-gray-400">
            {message.length} characters
          </p>
        </div>
      )}

      {voucherStatus === 1 && message.length > 0 && (
        hasPimlicoKey ? (
          <button
            type="button"
            onClick={handlePostMessage}
            disabled={!canPost}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {isPosting ? postStatus : "Post Message Anonymously"}
          </button>
        ) : (
          <div className="p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg text-yellow-300 text-sm space-y-3">
            <p className="font-medium">Pimlico API Key Required</p>
            <p>
              To post messages via ERC-4337, configure <code className="bg-gray-800 px-1 rounded">PIMLICO_API_KEY</code> in your <code className="bg-gray-800 px-1 rounded">.env.local</code> file.
            </p>
            <p>
              Get a free API key at{" "}
              <a href="https://dashboard.pimlico.io" target="_blank" rel="noopener noreferrer" className="underline">
                dashboard.pimlico.io
              </a>
            </p>
            <div className="pt-2 border-t border-yellow-500/30">
              <p className="text-xs text-gray-400 mb-2">VoucherBoard contract:</p>
              <code className="block p-2 bg-gray-800 rounded text-xs font-mono break-all">
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
                Voucher (raw value)
              </label>
              <div className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 font-mono break-all">
                {voucher}
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Your voucher will be consumed after posting
              </p>
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
      <div className="p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg text-purple-300 text-sm">
        <p className="font-medium mb-1">Anonymous Bulletin Board</p>
        <p>Post messages using your voucher. Your identity remains hidden as you do not send any transaction from your account.</p>
      </div>

      {renderStatusBanners()}

      {postStatus !== "success" && (
        <div className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voucher URL (paste to auto-fill)
            </label>
            <input
              type="text"
              value={voucherUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/0x.../topic/voucher or /0x.../topic/voucher"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              disabled={isPosting}
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
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
              disabled={isPosting}
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
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isPosting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voucher (raw value)
            </label>
            <input
              type="text"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
              disabled={isPosting}
              required
            />
            <p className="mt-1 text-sm text-gray-400">
              Your voucher will be consumed after posting
            </p>
          </div>

          {/* Check Voucher Button */}
          {issuer && topic && voucher && !checkTriggered && (
            <button
              type="button"
              onClick={handleCheckVoucher}
              disabled={isChecking || isPosting}
              className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors text-sm"
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
