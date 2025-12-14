import type { Hex } from "viem";
import { verifyRequestSchema, type VerifyResponse } from "../types";
import { verifyPayment } from "../services/verifyService";
import { config } from "../config";

/**
 * Handle POST /verify
 * Validates an EIP-3009 payment authorization without executing it
 */
export async function handleVerify(request: Request): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json();
    const parsed = verifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      const response: VerifyResponse = {
        isValid: false,
        invalidReason: `Invalid request format: ${parsed.error.message}`,
      };
      return Response.json(response, { status: 400 });
    }

    const { payload, requirements } = parsed.data;

    // Verify network matches
    if (payload.network !== config.networkId) {
      const response: VerifyResponse = {
        isValid: false,
        invalidReason: `Unsupported network: ${payload.network}. Expected: ${config.networkId}`,
      };
      return Response.json(response, { status: 400 });
    }

    // Verify scheme matches
    if (payload.scheme !== config.scheme) {
      const response: VerifyResponse = {
        isValid: false,
        invalidReason: `Unsupported scheme: ${payload.scheme}. Expected: ${config.scheme}`,
      };
      return Response.json(response, { status: 400 });
    }

    // Perform the verification
    const result = await verifyPayment(
      payload.payload.authorization,
      payload.payload.signature as Hex,
      requirements
    );

    const response: VerifyResponse = result.isValid
      ? { isValid: true, payer: result.payer! }
      : { isValid: false, invalidReason: result.invalidReason! };

    return Response.json(response);
  } catch (error) {
    const response: VerifyResponse = {
      isValid: false,
      invalidReason: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
    return Response.json(response, { status: 500 });
  }
}
