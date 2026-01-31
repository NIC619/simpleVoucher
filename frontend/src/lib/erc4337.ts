import { JsonRpcProvider } from "ethers";
import {
  ENTRY_POINT_V08_ADDRESS,
  EntryPointV08__factory,
  ERC4337Bundler,
  fetchGasPricePimlico,
  UserOpBuilder,
  isSameAddress,
} from "sendop";
import { encodeFunctionData, Hex, Address } from "viem";
import { VOUCHER_BOARD_ABI, VOUCHER_BOARD_ADDRESS } from "@/config/contract";
import { targetChain } from "@/config/wagmi";

// Get API keys from env
const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;

// Pimlico chain name mapping
const getPimlicoChainName = (chainId: number): string => {
  const mapping: Record<number, string> = {
    1: "mainnet",
    11155111: "sepolia",
    8453: "base",
    84532: "base-sepolia",
  };
  return mapping[chainId] || "sepolia";
};

// RPC and Bundler URLs
const getRpcUrl = () => {
  return process.env.NEXT_PUBLIC_RPC_URL || targetChain.rpcUrls.default.http[0];
};

const getBundlerUrl = () => {
  if (!PIMLICO_API_KEY) {
    throw new Error("NEXT_PUBLIC_PIMLICO_API_KEY not configured");
  }
  const chainName = getPimlicoChainName(targetChain.id);
  return `https://api.pimlico.io/v2/${chainName}/rpc?apikey=${PIMLICO_API_KEY}`;
};

// Get nonce from EntryPoint v0.8
async function getNonceV08(senderAddress: string, client: JsonRpcProvider): Promise<bigint> {
  const ep8 = EntryPointV08__factory.connect(ENTRY_POINT_V08_ADDRESS, client);
  return await ep8.getNonce(senderAddress, 0);
}

// Build and send UserOp for posting a message
export async function postMessageViaUserOp({
  issuer,
  topic,
  voucher,
  message,
  onStatusChange,
}: {
  issuer: Address;
  topic: string;
  voucher: Hex;
  message: string;
  onStatusChange?: (status: string) => void;
}): Promise<{ success: boolean; transactionHash?: string }> {
  if (!VOUCHER_BOARD_ADDRESS) {
    throw new Error("VOUCHER_BOARD_ADDRESS not configured");
  }

  const bundlerUrl = getBundlerUrl();
  const rpcUrl = getRpcUrl();

  // Create provider and bundler
  const client = new JsonRpcProvider(rpcUrl);
  const bundler = new ERC4337Bundler(bundlerUrl, undefined, {
    batchMaxCount: 1,
  });

  onStatusChange?.("Building UserOp...");

  // Encode the calldata
  const callData = encodeFunctionData({
    abi: VOUCHER_BOARD_ABI,
    functionName: "postMessage",
    args: [issuer, topic, voucher, message],
  });

  // Build UserOp
  const op = new UserOpBuilder({
    chainId: String(targetChain.id),
    bundler,
    entryPointAddress: ENTRY_POINT_V08_ADDRESS,
  })
    .setSender(VOUCHER_BOARD_ADDRESS)
    .setNonce(await getNonceV08(VOUCHER_BOARD_ADDRESS, client))
    .setCallData(callData)
    .setGasPrice(await fetchGasPricePimlico(bundlerUrl))
    .setSignature("0x"); // Empty signature - voucher acts as authorization

  onStatusChange?.("Estimating gas...");

  // Estimate gas
  try {
    await op.estimateGas();
  } catch (e) {
    console.error("Gas estimation failed:", e);
    console.info("handleOps data:", op.encodeHandleOpsDataWithDefaultGas());
    throw e;
  }

  onStatusChange?.("Sending to bundler...");

  // Send UserOp
  try {
    await op.send();
  } catch (e) {
    console.error("Send failed:", e);
    console.info("handleOps data:", op.encodeHandleOpsData());
    throw e;
  }

  const opHash = op.hash();
  console.log("UserOp hash:", opHash);

  onStatusChange?.("Waiting for confirmation...");

  // Wait for receipt
  const receipt = await op.wait();

  if (!receipt.success) {
    console.error("UserOp receipt:", receipt);
    throw new Error("UserOp execution failed");
  }

  // Extract transaction hash from logs
  const txLog = receipt.logs.find((log: { address: string }) =>
    VOUCHER_BOARD_ADDRESS && isSameAddress(log.address, VOUCHER_BOARD_ADDRESS)
  );
  const transactionHash = txLog?.transactionHash;

  return {
    success: true,
    transactionHash,
  };
}
