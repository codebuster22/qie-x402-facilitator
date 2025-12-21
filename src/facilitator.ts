import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { gasInjectedClient } from "./client";

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
export const facilitator = new x402Facilitator()
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
    console.log(
      "[settle] Processing payment from:",
      getAuthFrom(ctx.paymentPayload)
    );
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
