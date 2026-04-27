import { NextRequest, NextResponse } from "next/server";

const ENTRY_POINT_V08_ADDRESS = "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";

// Pimlico chain name mapping
const pimlicoChainNames: Record<string, string> = {
  mainnet: "mainnet",
  sepolia: "sepolia",
  base: "base",
  "base-sepolia": "base-sepolia",
};

const chainIds: Record<string, number> = {
  mainnet: 1,
  sepolia: 11155111,
  base: 8453,
  "base-sepolia": 84532,
};

const allowedMethods = new Set([
  "pimlico_getUserOperationGasPrice",
  "eth_estimateUserOperationGas",
  "eth_sendUserOperation",
  "eth_getUserOperationByHash",
  "eth_getUserOperationReceipt",
  "eth_chainId",
]);

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown[];
}

function getBundlerUrl(): string | null {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) return null;

  const chain = process.env.NEXT_PUBLIC_CHAIN || "sepolia";
  const chainName = pimlicoChainNames[chain] || "sepolia";
  return `https://api.pimlico.io/v2/${chainName}/rpc?apikey=${apiKey}`;
}

function getTargetChainId(): number {
  const chain = process.env.NEXT_PUBLIC_CHAIN || "sepolia";
  return chainIds[chain] || chainIds.sepolia;
}

function isHexString(value: unknown, bytes?: number): value is string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) return false;
  if (value.length % 2 !== 0) return false;
  return bytes === undefined || value.length === 2 + bytes * 2;
}

function isSameAddress(a: unknown, b: string | undefined): boolean {
  return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string") return null;
  if (/^0x[0-9a-fA-F]+$/.test(value)) return Number.parseInt(value, 16);
  if (/^[0-9]+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

function validateUserOp(method: string, params: unknown[] | undefined): string | null {
  if (method !== "eth_estimateUserOperationGas" && method !== "eth_sendUserOperation") {
    return null;
  }

  if (!Array.isArray(params) || params.length < 2) {
    return `${method} requires userOperation and entryPoint params`;
  }

  const [userOp, entryPoint] = params;
  if (typeof userOp !== "object" || userOp === null || Array.isArray(userOp)) {
    return "Invalid userOperation";
  }

  const op = userOp as Record<string, unknown>;

  if (!isSameAddress(entryPoint, ENTRY_POINT_V08_ADDRESS)) {
    return "Unsupported EntryPoint";
  }

  if (!isSameAddress(op.sender, process.env.NEXT_PUBLIC_VOUCHER_BOARD_ADDRESS)) {
    return "Unsupported UserOperation sender";
  }

  const paymasterAndData = op.paymasterAndData;
  if (paymasterAndData !== undefined && paymasterAndData !== "0x") {
    return "Paymaster data is not supported by this app";
  }

  const eip7702Auth = op.eip7702Auth;
  if (typeof eip7702Auth === "object" && eip7702Auth !== null && !Array.isArray(eip7702Auth)) {
    const chainId = parseChainId((eip7702Auth as Record<string, unknown>).chainId);
    if (chainId !== null && chainId !== getTargetChainId()) {
      return "UserOperation targets a different chain";
    }
  }

  return null;
}

function validatePaymasterParams(method: string, params: unknown[] | undefined): string | null {
  if (method !== "pm_getPaymasterStubData" && method !== "pm_getPaymasterData") {
    return null;
  }

  if (!Array.isArray(params) || params.length < 3) {
    return `${method} requires userOperation, entryPoint, and chainId params`;
  }

  const chainId = parseChainId(params[2]);
  if (chainId !== getTargetChainId()) {
    return "Paymaster request targets a different chain";
  }

  return validateUserOp("eth_estimateUserOperationGas", params);
}

function validateJsonRpcRequest(payload: JsonRpcRequest): string | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return "Invalid JSON-RPC request";
  }

  if (payload.jsonrpc !== "2.0") return "Invalid JSON-RPC version";
  if (typeof payload.method !== "string") return "Missing JSON-RPC method";
  if (!allowedMethods.has(payload.method)) return `JSON-RPC method not allowed: ${payload.method}`;

  if (payload.method === "eth_chainId" || payload.method === "pimlico_getUserOperationGasPrice") {
    if (payload.params !== undefined && (!Array.isArray(payload.params) || payload.params.length !== 0)) {
      return `${payload.method} does not accept params`;
    }
  }

  if (payload.method === "eth_getUserOperationByHash" || payload.method === "eth_getUserOperationReceipt") {
    if (!Array.isArray(payload.params) || payload.params.length !== 1 || !isHexString(payload.params[0], 32)) {
      return `${payload.method} requires a userOpHash`;
    }
  }

  return validateUserOp(payload.method, payload.params) ?? validatePaymasterParams(payload.method, payload.params);
}

function jsonRpcError(id: JsonRpcRequest["id"], message: string, status = 400) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32600, message },
    },
    { status }
  );
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
  let payload: JsonRpcRequest | JsonRpcRequest[];

  try {
    payload = JSON.parse(body);
  } catch {
    return jsonRpcError(null, "Invalid JSON", 400);
  }

  const requests = Array.isArray(payload) ? payload : [payload];
  if (requests.length === 0) {
    return jsonRpcError(null, "Empty JSON-RPC batch", 400);
  }

  for (const rpcRequest of requests) {
    const validationError = validateJsonRpcRequest(rpcRequest);
    if (validationError) {
      const id =
        typeof rpcRequest === "object" && rpcRequest !== null && !Array.isArray(rpcRequest)
          ? rpcRequest.id
          : null;
      return jsonRpcError(id, validationError, 403);
    }
  }

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
