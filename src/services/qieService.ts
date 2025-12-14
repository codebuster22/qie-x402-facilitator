import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qieChain, config } from "../config";
import { qUSDAbi } from "../abis/qUSDAbi";

// Create public client for read operations
export const publicClient = createPublicClient({
  chain: qieChain,
  transport: http(),
});

// Create facilitator account from private key
const facilitatorAccount = config.facilitatorPrivateKey
  ? privateKeyToAccount(config.facilitatorPrivateKey)
  : null;

// Create wallet client for write operations (if private key is configured)
export const walletClient = facilitatorAccount
  ? createWalletClient({
      account: facilitatorAccount,
      chain: qieChain,
      transport: http(),
    })
  : null;

/**
 * Get user's qUSD balance
 */
export async function getBalance(address: Address): Promise<bigint> {
  return await publicClient.readContract({
    address: config.qusdContractAddress,
    abi: qUSDAbi,
    functionName: "balanceOf",
    args: [address],
  });
}

/**
 * Check if nonce has been used for a given authorizer
 * Returns true if the nonce has already been used
 */
export async function isNonceUsed(
  authorizer: Address,
  nonce: Hex
): Promise<boolean> {
  return await publicClient.readContract({
    address: config.qusdContractAddress,
    abi: qUSDAbi,
    functionName: "authorizationState",
    args: [authorizer, nonce],
  });
}

/**
 * Execute transferWithAuthorization on the qUSD contract
 * The facilitator pays the gas fees
 */
export async function executeTransferWithAuthorization(
  from: Address,
  to: Address,
  value: bigint,
  validAfter: bigint,
  validBefore: bigint,
  nonce: Hex,
  v: number,
  r: Hex,
  s: Hex
): Promise<Hex> {
  if (!walletClient) {
    throw new Error("Wallet client not configured - missing FACILITATOR_PRIVATE_KEY");
  }

  const hash = await walletClient.writeContract({
    address: config.qusdContractAddress,
    abi: qUSDAbi,
    functionName: "transferWithAuthorization",
    args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
  });

  return hash;
}

/**
 * Get the facilitator's address
 */
export function getFacilitatorAddress(): Address {
  if (!facilitatorAccount) {
    throw new Error("Facilitator account not configured - missing FACILITATOR_PRIVATE_KEY");
  }
  return facilitatorAccount.address;
}

/**
 * Check if the facilitator is properly configured
 */
export function isFacilitatorConfigured(): boolean {
  return facilitatorAccount !== null && config.qusdContractAddress !== undefined;
}
