import type { Address, Hex } from "viem";
import { settleRequestSchema, type SettleResponse } from "../types";
import { verifyPayment } from "../services/verifyService";
import { executeTransferWithAuthorization } from "../services/qieService";
import { config } from "../config";

/**
 * Parse a signature into its v, r, s components
 */
function parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  // Remove 0x prefix
  const sig = signature.slice(2);

  // Extract r (first 32 bytes / 64 hex chars)
  const r = `0x${sig.slice(0, 64)}` as Hex;

  // Extract s (next 32 bytes / 64 hex chars)
  const s = `0x${sig.slice(64, 128)}` as Hex;

  // Extract v (last byte / 2 hex chars)
  let v = parseInt(sig.slice(128, 130), 16);

  // Handle EIP-155 v values (transform to standard 27/28)
  if (v < 27) {
    v += 27;
  }

  return { v, r, s };
}

/**
 * Handle POST /settle
 * Executes the payment on-chain after re-verification
 */
export async function handleSettle(request: Request): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json();
    const parsed = settleRequestSchema.safeParse(body);

    if (!parsed.success) {
      const response: SettleResponse = {
        success: false,
        errorReason: `Invalid request format: ${parsed.error.message}`,
      };
      return Response.json(response, { status: 400 });
    }

    const { payload, requirements } = parsed.data;

    // Verify network matches
    if (payload.network !== config.networkId) {
      const response: SettleResponse = {
        success: false,
        errorReason: `Unsupported network: ${payload.network}. Expected: ${config.networkId}`,
      };
      return Response.json(response, { status: 400 });
    }

    // Verify scheme matches
    if (payload.scheme !== config.scheme) {
      const response: SettleResponse = {
        success: false,
        errorReason: `Unsupported scheme: ${payload.scheme}. Expected: ${config.scheme}`,
      };
      return Response.json(response, { status: 400 });
    }

    // Re-verify the payment before settling (prevent race conditions)
    const verifyResult = await verifyPayment(
      payload.payload.authorization,
      payload.payload.signature as Hex,
      requirements
    );

    if (!verifyResult.isValid) {
      const response: SettleResponse = {
        success: false,
        errorReason: verifyResult.invalidReason!,
      };
      return Response.json(response, { status: 400 });
    }

    // Parse signature into v, r, s components
    const { v, r, s } = parseSignature(payload.payload.signature as Hex);
    const auth = payload.payload.authorization;

    // Execute the transfer on-chain
    const txHash = await executeTransferWithAuthorization(
      auth.from as Address,
      auth.to as Address,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as Hex,
      v,
      r,
      s
    );

    const response: SettleResponse = {
      success: true,
      transaction: txHash,
      network: config.networkId,
      payer: verifyResult.payer!,
    };

    return Response.json(response);
  } catch (error) {
    const response: SettleResponse = {
      success: false,
      errorReason: `Settlement failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
    return Response.json(response, { status: 500 });
  }
}
