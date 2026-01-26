import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { mainnet, sepolia, base, baseSepolia, type Chain } from "wagmi/chains";

// Supported chains
const chains: Record<string, Chain> = {
  mainnet,
  sepolia,
  base,
  "base-sepolia": baseSepolia,
};

// Get target chain from env variable (default: sepolia)
const chainName = process.env.NEXT_PUBLIC_CHAIN || "sepolia";
export const targetChain = chains[chainName] || sepolia;

export const config = createConfig({
  chains: [targetChain],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [targetChain.id]: http(),
  },
});
