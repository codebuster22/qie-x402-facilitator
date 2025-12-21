import { defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

if (!process.env.FACILITATOR_PRIVATE_KEY) {
  throw new Error("FACILITATOR_PRIVATE_KEY environment variable is required");
}

export const account = privateKeyToAccount(
  process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`
);

export const RPC_URL = process.env.QIE_RPC_URL || "https://rpc1mainnet.qie.digital/";
export const PORT = parseInt(process.env.PORT || "3000", 10);

export const qieChain = defineChain({
  id: 1990,
  name: "QIE Mainnet",
  nativeCurrency: {
    name: "QIEV3",
    symbol: "QIEV3",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "QIE Explorer",
      url: "https://mainnet.qie.digital/",
    },
  },
});
