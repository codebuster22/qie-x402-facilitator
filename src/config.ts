import { defineChain } from "viem";

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
      http: [process.env.QIE_RPC_URL || "https://rpc1mainnet.qie.digital/"],
    },
  },
  blockExplorers: {
    default: {
      name: "QIE Explorer",
      url: "https://mainnet.qie.digital/",
    },
  },
});
