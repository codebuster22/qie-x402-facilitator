import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { getBalance, isNonceUsed } from "./qieService";
import { config, qieChain } from "../config";
import type { Authorization, PaymentRequirements } from "../types";

// EIP-3009 TransferWithAuthorization type definition
const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface VerificationResult {
  isValid: boolean;
  payer?: Address;
  invalidReason?: string;
}

/**
 * Verify an EIP-3009 payment authorization
 * Checks signature validity, time bounds, nonce state, and balance
 */
export async function verifyPayment(
  authorization: Authorization,
  signature: Hex,
  requirements: PaymentRequirements
): Promise<VerificationResult> {
  try {
    // Build EIP-712 domain
    const domain = {
      name: config.tokenName,
      version: config.tokenVersion,
      chainId: qieChain.id,
      verifyingContract: config.qusdContractAddress,
    };

    // 1. Recover signer address from signature
    const recoveredAddress = await recoverTypedDataAddress({
      domain,
      types: transferWithAuthorizationTypes,
      primaryType: "TransferWithAuthorization",
      message: {
        from: authorization.from as Address,
        to: authorization.to as Address,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce as Hex,
      },
      signature,
    });

    // 2. Verify signer matches 'from' address
    if (recoveredAddress.toLowerCase() !== authorization.from.toLowerCase()) {
      return {
        isValid: false,
        invalidReason: `Signer mismatch: recovered ${recoveredAddress}, expected ${authorization.from}`,
      };
    }

    // 3. Check time validity
    const now = Math.floor(Date.now() / 1000);
    const validAfter = parseInt(authorization.validAfter);
    const validBefore = parseInt(authorization.validBefore);

    if (now < validAfter) {
      return {
        isValid: false,
        invalidReason: `Authorization not yet valid: valid after ${validAfter}, current time ${now}`,
      };
    }

    if (now >= validBefore) {
      return {
        isValid: false,
        invalidReason: `Authorization has expired: valid before ${validBefore}, current time ${now}`,
      };
    }

    // 4. Check nonce hasn't been used
    const nonceUsed = await isNonceUsed(
      authorization.from as Address,
      authorization.nonce as Hex
    );

    if (nonceUsed) {
      return {
        isValid: false,
        invalidReason: "Nonce has already been used",
      };
    }

    // 5. Check user has sufficient balance
    const balance = await getBalance(authorization.from as Address);
    const requiredAmount = BigInt(requirements.amount);

    if (balance < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `Insufficient balance: has ${balance.toString()}, needs ${requiredAmount.toString()}`,
      };
    }

    // 6. Verify authorization amount meets requirements
    const authAmount = BigInt(authorization.value);
    if (authAmount < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `Authorization amount ${authAmount.toString()} is less than required ${requiredAmount.toString()}`,
      };
    }

    // 7. Verify recipient matches requirements
    if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return {
        isValid: false,
        invalidReason: `Recipient mismatch: authorization to ${authorization.to}, required ${requirements.payTo}`,
      };
    }

    // 8. Verify asset matches (token contract address)
    if (
      requirements.asset.toLowerCase() !==
      config.qusdContractAddress.toLowerCase()
    ) {
      return {
        isValid: false,
        invalidReason: `Asset mismatch: requirement specifies ${requirements.asset}, facilitator manages ${config.qusdContractAddress}`,
      };
    }

    // All checks passed
    return {
      isValid: true,
      payer: recoveredAddress,
    };
  } catch (error) {
    return {
      isValid: false,
      invalidReason: `Verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
