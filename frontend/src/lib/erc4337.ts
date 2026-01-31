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

// API route proxies (secrets stay server-side)
const getRpcUrl = () => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/rpc`;
};

const getBundlerUrl = () => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/bundler`;
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
