import { NextRequest, NextResponse } from "next/server";

// Default public RPC URLs per chain
const defaultRpcUrls: Record<string, string> = {
  mainnet: "https://ethereum-rpc.publicnode.com",
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  base: "https://base-rpc.publicnode.com",
  "base-sepolia": "https://base-sepolia-rpc.publicnode.com",
};

function getRpcUrl(): string {
  if (process.env.RPC_URL) {
    return process.env.RPC_URL;
  }
  const chain = process.env.NEXT_PUBLIC_CHAIN || "sepolia";
  return defaultRpcUrls[chain] || defaultRpcUrls["sepolia"];
}

export async function POST(request: NextRequest) {
  const rpcUrl = getRpcUrl();
  const body = await request.text();

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
