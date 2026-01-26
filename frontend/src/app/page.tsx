"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { NetworkGuard } from "@/components/NetworkGuard";
import { IssuePage } from "@/components/IssuePage";
import { PostMessagePage } from "@/components/PostMessagePage";
import { RedeemPage } from "@/components/RedeemPage";

type Tab = "issue" | "post" | "redeem";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("issue");

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Simple Voucher</h1>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-8">
          <button
            onClick={() => setActiveTab("issue")}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === "issue"
                ? "text-blue-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Issue Vouchers
            {activeTab === "issue" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("post")}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === "post"
                ? "text-purple-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Post Message
            {activeTab === "post" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("redeem")}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === "redeem"
                ? "text-green-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Redeem Voucher
            {activeTab === "redeem" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <NetworkGuard>
          {activeTab === "issue" && <IssuePage />}
          {activeTab === "post" && <PostMessagePage />}
          {activeTab === "redeem" && <RedeemPage />}
        </NetworkGuard>
      </div>
    </main>
  );
}
