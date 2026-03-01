"use client";

import { useState } from "react";
import { usePublicClient } from "wagmi";
import { VOUCHER_BOARD_ABI, VOUCHER_BOARD_ADDRESS } from "@/config/contract";
import { targetChain } from "@/config/wagmi";

interface MessageEvent {
  issuer: string;
  topic: string;
  voucherHash: string;
  message: string;
  blockNumber: bigint;
  transactionHash: string;
}

interface MessageBoardProps {
  defaultIssuer?: string;
  defaultTopic?: string;
}

type RangeMode = "preset" | "custom";

const MAX_DISPLAY = 100;

export function MessageBoard({ defaultIssuer, defaultTopic }: MessageBoardProps) {
  const [issuer, setIssuer] = useState(defaultIssuer || "");
  const [topic, setTopic] = useState(defaultTopic || "");
  const [blockRange, setBlockRange] = useState(5000);
  const [rangeMode, setRangeMode] = useState<RangeMode>("preset");
  const [customFromBlock, setCustomFromBlock] = useState("");
  const [customToBlock, setCustomToBlock] = useState("");
  const [messages, setMessages] = useState<MessageEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchedRange, setSearchedRange] = useState<{ from: bigint; to: bigint } | null>(null);

  const publicClient = usePublicClient();

  const handleSearch = async () => {
    if (!publicClient || !VOUCHER_BOARD_ADDRESS || !issuer) return;

    setIsLoading(true);
    setError(null);
    setSearchPerformed(true);
    setMessages([]);

    try {
      const currentBlock = await publicClient.getBlockNumber();

      let toBlock: bigint;
      let fromBlock: bigint;

      if (rangeMode === "custom") {
        toBlock = customToBlock ? BigInt(customToBlock) : currentBlock;
        fromBlock = customFromBlock ? BigInt(customFromBlock) : BigInt(0);
      } else {
        toBlock = currentBlock;
        fromBlock = currentBlock - BigInt(blockRange);
      }

      if (fromBlock < BigInt(0)) fromBlock = BigInt(0);

      setSearchedRange({ from: fromBlock, to: toBlock });

      const logs = await publicClient.getContractEvents({
        address: VOUCHER_BOARD_ADDRESS,
        abi: VOUCHER_BOARD_ABI,
        eventName: "MessagePosted",
        args: { issuer: issuer as `0x${string}` },
        fromBlock,
        toBlock,
      });

      const filtered = topic ? logs.filter((log) => log.args.topic === topic) : logs;

      const results: MessageEvent[] = filtered.map((log) => ({
        issuer: log.args.issuer as string,
        topic: log.args.topic as string,
        voucherHash: log.args.voucherHash as string,
        message: log.args.message as string,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }));

      results.sort((a, b) => Number(b.blockNumber - a.blockNumber));
      setMessages(results);
    } catch (err) {
      console.error("Failed to query messages:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      if (errMsg.toLowerCase().includes("range") || errMsg.includes("10000") || errMsg.includes("exceeds")) {
        setError(`RPC block range limit exceeded. Try reducing the block range (current: ${rangeMode === "custom" ? "custom" : blockRange}).`);
      } else {
        setError(`Failed to fetch messages: ${errMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!VOUCHER_BOARD_ADDRESS) {
    return (
      <div className="mt-8 p-4 border border-line rounded-[var(--radius)] bg-surface">
        <h3 className="text-base font-semibold mb-2">Message Board</h3>
        <p className="text-sm" style={{ color: "var(--warning-text)" }}>
          VoucherBoard contract address not configured. Set NEXT_PUBLIC_VOUCHER_BOARD_ADDRESS in .env.local
        </p>
      </div>
    );
  }

  const explorerUrl = targetChain.blockExplorers?.default?.url;
  const displayedMessages = messages.slice(0, MAX_DISPLAY);

  return (
    <div className="mt-8 p-4 border border-line rounded-[var(--radius)] bg-surface space-y-4">
      <div>
        <h3 className="text-base font-semibold">Message Board</h3>
        <p className="text-sm text-muted">Search for posted messages by issuer and topic</p>
      </div>

      {/* Search Form */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Issuer Address</label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Topic <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Leave empty to show all topics"
            className="w-full px-3 py-2 text-sm"
          />
        </div>

        {/* Block Range Controls */}
        <div>
          <label className="block text-sm font-medium mb-1">Block Range</label>
          <div className="flex gap-2 items-start">
            <select
              value={rangeMode === "custom" ? "custom" : String(blockRange)}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setRangeMode("custom");
                } else {
                  setRangeMode("preset");
                  setBlockRange(Number(e.target.value));
                }
              }}
              className="px-3 py-2 text-sm"
            >
              <option value="1000">Last 1,000 blocks</option>
              <option value="5000">Last 5,000 blocks</option>
              <option value="10000">Last 10,000 blocks</option>
              <option value="50000">Last 50,000 blocks</option>
              <option value="custom">Custom range</option>
            </select>

            {rangeMode === "custom" && (
              <div className="flex gap-2 items-center text-sm">
                <input
                  type="text"
                  value={customFromBlock}
                  onChange={(e) => setCustomFromBlock(e.target.value)}
                  placeholder="From block (0)"
                  className="w-36 px-3 py-2 text-sm font-mono"
                />
                <span className="text-muted">to</span>
                <input
                  type="text"
                  value={customToBlock}
                  onChange={(e) => setCustomToBlock(e.target.value)}
                  placeholder="To block (latest)"
                  className="w-36 px-3 py-2 text-sm font-mono"
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading || !issuer}
          className="w-full py-2 px-4 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-[var(--radius)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? "Searching..." : "Search Messages"}
        </button>
      </div>

      {error && (
        <div
          className="p-3 border rounded-[var(--radius)] text-sm"
          style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}
        >
          {error}
        </div>
      )}

      {searchPerformed && !isLoading && !error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {messages.length === 0 ? "No messages found" : `Found ${messages.length} message(s)`}
              {messages.length > MAX_DISPLAY && ` (showing first ${MAX_DISPLAY})`}
            </p>
            {searchedRange && (
              <p className="text-xs text-muted">
                Blocks {searchedRange.from.toString()} – {searchedRange.to.toString()}
              </p>
            )}
          </div>

          {messages.length === 0 && (
            <p className="text-sm text-muted">
              Try expanding the block range or checking the issuer address and topic.
            </p>
          )}

          {displayedMessages.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {displayedMessages.map((msg, i) => (
                <div key={i} className="p-3 bg-bg border border-line rounded-[var(--radius)] space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      Topic: <span className="text-accent">{msg.topic}</span>
                    </span>
                    <span>Block #{msg.blockNumber.toString()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-mono" title={msg.voucherHash}>
                      {msg.voucherHash.slice(0, 10)}...{msg.voucherHash.slice(-8)}
                    </span>
                    {explorerUrl && (
                      <a
                        href={`${explorerUrl}/tx/${msg.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-hover underline"
                      >
                        View tx
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
