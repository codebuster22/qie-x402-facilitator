import { z } from "zod";

// Address validation (0x followed by 40 hex chars)
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// Hex string validation
const hexSchema = z.string().regex(/^0x[a-fA-F0-9]*$/);

// Bytes32 validation (0x followed by 64 hex chars)
const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

// EIP-3009 Authorization structure
export const authorizationSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  value: z.string(), // BigInt as string
  validAfter: z.string(), // Unix timestamp as string
  validBefore: z.string(), // Unix timestamp as string
  nonce: bytes32Schema,
});

// Exact scheme payload (EIP-3009)
export const exactPayloadSchema = z.object({
  signature: hexSchema,
  authorization: authorizationSchema,
});

// Payment Requirements
export const paymentRequirementsSchema = z.object({
  scheme: z.literal("exact"),
  network: z.string(),
  asset: addressSchema,
  amount: z.string(),
  payTo: addressSchema,
  maxTimeoutSeconds: z.number(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

// Full Payment Payload
export const paymentPayloadSchema = z.object({
  x402Version: z.number(),
  scheme: z.literal("exact"),
  network: z.string(),
  payload: exactPayloadSchema,
});

// Verify Request
export const verifyRequestSchema = z.object({
  payload: paymentPayloadSchema,
  requirements: paymentRequirementsSchema,
});

// Settle Request
export const settleRequestSchema = z.object({
  payload: paymentPayloadSchema,
  requirements: paymentRequirementsSchema,
});

// Response types
export type VerifyResponse =
  | { isValid: true; payer: string }
  | { isValid: false; invalidReason: string };

export type SettleResponse =
  | { success: true; transaction: string; network: string; payer: string }
  | { success: false; errorReason: string };

export type SupportedResponse = {
  x402Version: number;
  schemes: string[];
  networks: string[];
  assets: { network: string; asset: string; name: string }[];
  signerAddress: string;
};

// Infer types from schemas
export type Authorization = z.infer<typeof authorizationSchema>;
export type ExactPayload = z.infer<typeof exactPayloadSchema>;
export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;
export type PaymentRequirements = z.infer<typeof paymentRequirementsSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
export type SettleRequest = z.infer<typeof settleRequestSchema>;
