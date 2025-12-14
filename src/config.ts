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

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  facilitatorPrivateKey: process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`,
  qusdContractAddress: process.env.QUSD_CONTRACT_ADDRESS as `0x${string}`,
  networkId: "eip155:1990",
  scheme: "exact" as const,
  x402Version: 1,
  // EIP-712 domain values for qUSD
  tokenName: "qUSD",
  tokenVersion: "1",
};
