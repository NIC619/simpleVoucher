"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { ConfigWarnings } from "@/components/ConfigWarnings";
import { NetworkGuard } from "@/components/NetworkGuard";
import { IssuePage } from "@/components/IssuePage";
import { PostMessagePage } from "@/components/PostMessagePage";
import { ClaimTokenPage } from "@/components/ClaimTokenPage";
type Tab = "issue" | "post" | "claim";

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
        {/* Config Warnings */}
        <ConfigWarnings />

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
            onClick={() => setActiveTab("claim")}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === "claim"
                ? "text-green-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Claim Token
            {activeTab === "claim" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <NetworkGuard>
          {activeTab === "issue" && <IssuePage />}
          {activeTab === "post" && <PostMessagePage />}
          {activeTab === "claim" && <ClaimTokenPage />}
        </NetworkGuard>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <a
            href="https://github.com/NIC619/simpleVoucher"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors inline-block"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-label="GitHub"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </footer>
    </main>
  );
}
