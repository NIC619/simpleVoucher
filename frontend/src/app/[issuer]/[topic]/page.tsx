"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { NetworkGuard } from "@/components/NetworkGuard";
import { RedeemPage } from "@/components/RedeemPage";
import Link from "next/link";

interface PageProps {
  params: {
    issuer: string;
    topic: string;
  };
}

export default function RedeemWithParams({ params }: PageProps) {
  const { issuer, topic } = params;

  // Decode URI components (in case topic has special characters)
  const decodedTopic = decodeURIComponent(topic);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold hover:text-blue-400 transition-colors">
            Simple Voucher
          </Link>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            &larr; Back to Home
          </Link>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-green-400">Redeem Voucher</h2>

        <NetworkGuard>
          <RedeemPage prefillIssuer={issuer} prefillTopic={decodedTopic} />
        </NetworkGuard>
      </div>
    </main>
  );
}
