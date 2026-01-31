import { NextRequest, NextResponse } from "next/server";

// Pimlico chain name mapping
const pimlicoChainNames: Record<string, string> = {
  mainnet: "mainnet",
  sepolia: "sepolia",
  base: "base",
  "base-sepolia": "base-sepolia",
};

function getBundlerUrl(): string | null {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) return null;

  const chain = process.env.NEXT_PUBLIC_CHAIN || "sepolia";
  const chainName = pimlicoChainNames[chain] || "sepolia";
  return `https://api.pimlico.io/v2/${chainName}/rpc?apikey=${apiKey}`;
}

export async function POST(request: NextRequest) {
  const bundlerUrl = getBundlerUrl();
  if (!bundlerUrl) {
    return NextResponse.json(
      { error: "Bundler not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();

  const response = await fetch(bundlerUrl, {
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
