import { config } from "../config";
import { getFacilitatorAddress, isFacilitatorConfigured } from "../services/qieService";
import type { SupportedResponse } from "../types";

/**
 * Handle GET /supported
 * Returns the facilitator's supported schemes, networks, and assets
 */
export function handleSupported(): Response {
  if (!isFacilitatorConfigured()) {
    return Response.json(
      { error: "Facilitator not properly configured" },
      { status: 503 }
    );
  }

  const response: SupportedResponse = {
    x402Version: config.x402Version,
    schemes: [config.scheme],
    networks: [config.networkId],
    assets: [
      {
        network: config.networkId,
        asset: config.qusdContractAddress,
        name: "qUSD",
      },
    ],
    signerAddress: getFacilitatorAddress(),
  };

  return Response.json(response);
}
