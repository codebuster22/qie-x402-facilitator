import {
  createWalletClient,
  encodeFunctionData,
  http,
  publicActions,
} from "viem";
import { qieChain, RPC_URL, account } from "./config";

// Create wallet client with public actions (combined client)
// This gives us both read (publicClient) and write (walletClient) capabilities
export const client = createWalletClient({
  account,
  chain: qieChain,
  transport: http(RPC_URL),
}).extend(publicActions);

const extendedWriteContract =
  (c: typeof client) =>
  async (args: Parameters<(typeof client)["writeContract"]>[0]) => {

    const requestData = encodeFunctionData({
      abi: args.abi,
      functionName: args.functionName,
      args: args.args,
    });

    try {
      const gasEstimate = await client.request({
        method: "eth_estimateGas",
        params: [
          {
            from: client.account.address,
            to: args.address,
            data: requestData,
          },
        ],
      });

      args.gas = BigInt(gasEstimate);

      return await client.writeContract(args as any);
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  };

export const gasInjectedClient = client.extend((client) => ({
    writeContract: (args) =>
      extendedWriteContract(client as unknown as typeof client)(args),
  }
));
