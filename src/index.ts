import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import {
  createWalletClient,
  http,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qieChain } from "./config";

// Fixed gas limit for all transactions on QIE network
// Required because QIE's eth_estimateGas returns insufficient gas (24,000)
const FIXED_GAS_LIMIT = 1_000_000n;

// Validate environment
if (!process.env.FACILITATOR_PRIVATE_KEY) {
  throw new Error("FACILITATOR_PRIVATE_KEY environment variable is required");
}

// Create Viem account from private key
const account = privateKeyToAccount(
  process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`
);

console.log("Facilitator address:", account.address);

// Create wallet client with public actions (combined client)
// This gives us both read (publicClient) and write (walletClient) capabilities
const client = createWalletClient({
  account,
  chain: qieChain,
  transport: http(),
}).extend(publicActions);

// Create a gas-injected wrapper to ensure all transactions use FIXED_GAS_LIMIT
// This is necessary because x402's FacilitatorEvmSigner interface doesn't expose gas params
const gasInjectedClient = {
  ...client,
  writeContract: (args: Parameters<typeof client.writeContract>[0]) =>
    client.writeContract({ ...args, gas: FIXED_GAS_LIMIT }),
  sendTransaction: (args: Parameters<typeof client.sendTransaction>[0]) =>
    client.sendTransaction({ ...args, gas: FIXED_GAS_LIMIT }),
};

// Convert to x402 facilitator signer
// Using type assertion due to minor type incompatibility between viem and x402 signer interface
const evmSigner = toFacilitatorEvmSigner(
  gasInjectedClient as unknown as Parameters<typeof toFacilitatorEvmSigner>[0]
);

// Helper to safely extract authorization from payload
function getAuthFrom(payload: unknown): string {
  const p = payload as { payload?: { authorization?: { from?: string } } };
  return p?.payload?.authorization?.from || "unknown";
}

// Create x402 Facilitator with lifecycle hooks
const facilitator = new x402Facilitator()
  .onBeforeVerify(async (ctx) => {
    console.log("[verify] From:", getAuthFrom(ctx.paymentPayload));
  })
  .onAfterVerify(async (ctx) => {
    console.log("[verify] Result:", ctx.result.isValid);
  })
  .onVerifyFailure(async (ctx) => {
    console.error("[verify] Failed:", ctx.error.message);
  })
  .onBeforeSettle(async (ctx) => {
    console.log("[settle] Processing payment from:", getAuthFrom(ctx.paymentPayload));
  })
  .onAfterSettle(async (ctx) => {
    console.log("[settle] Result:", ctx.result.success);
    console.log(ctx.result);
    console.log(ctx.paymentPayload);
    if (ctx.result.success) {
      console.log("[settle] Transaction:", ctx.result.transaction);
    }
  })
  .onSettleFailure(async (ctx) => {
    console.error("[settle] Failed:", ctx.error.message);
  });

// Register EVM exact scheme for QIE network (eip155:1990)
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:1990",
});

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// HTTP server
const server = Bun.serve({
  port: parseInt(process.env.PORT || "3000", 10),

  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let result: unknown;

      if (req.method === "GET" && url.pathname === "/supported") {
        result = facilitator.getSupported();
      } else if (req.method === "POST" && url.pathname === "/verify") {
        const body = (await req.json()) as {
          paymentPayload: Parameters<typeof facilitator.verify>[0];
          paymentRequirements: Parameters<typeof facilitator.verify>[1];
        };
        result = await facilitator.verify(body.paymentPayload, body.paymentRequirements);
      } else if (req.method === "POST" && url.pathname === "/settle") {
        const body = (await req.json()) as {
          paymentPayload: Parameters<typeof facilitator.settle>[0];
          paymentRequirements: Parameters<typeof facilitator.settle>[1];
        };
        result = await facilitator.settle(body.paymentPayload, body.paymentRequirements);
        console.log(result);
      } else if (req.method === "GET" && url.pathname === "/health") {
        result = { status: "ok", timestamp: Date.now() };
      } else if (req.method === "GET" && url.pathname === "/") {
        result = {
          name: "x402 Facilitator for QIE",
          network: "eip155:1990",
          facilitator: account.address,
          endpoints: ["/supported", "/verify", "/settle", "/health"],
        };
      } else {
        return Response.json(
          { error: "Not Found" },
          { status: 404, headers: corsHeaders }
        );
      }

      return Response.json(result, { headers: corsHeaders });
    } catch (error) {
      console.error("Error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: corsHeaders }
      );
    }
  },
});

console.log(`
x402 Facilitator for QIE Blockchain
===================================
Network:    eip155:1990 (QIE Mainnet)
Listening:  http://localhost:${server.port}
Endpoints:  /supported, /verify, /settle, /health
`);
