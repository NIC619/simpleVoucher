import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { mainnet, sepolia, localhost } from "wagmi/chains";

export const config = createConfig({
  chains: [localhost, sepolia, mainnet],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [localhost.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
});
