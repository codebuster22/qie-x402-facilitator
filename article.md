# When Gas Estimation Lies: Fixing a Silent Transaction Killer in Blockchain Development

Every blockchain developer eventually faces that moment: transactions fail silently, error messages are cryptic, and the culprit is hiding in plain sight. This is the story of how a seemingly innocent RPC response broke our entire payment system—and the elegant hack we used to fix it.

## The Setup

We were building a payment facilitator for the [x402 protocol](https://www.x402.org/)—a standard for HTTP-native payments using cryptocurrency. Our facilitator needed to process EIP-3009 `transferWithAuthorization` transactions on the QIE blockchain (a custom EVM-compatible chain).

The stack was straightforward:
- **x402**: Payment protocol handling verification and settlement
- **Viem**: TypeScript library for Ethereum interactions
- **QIE Blockchain**: EVM-compatible chain (Chain ID: 1990)

Everything looked perfect on paper. The code compiled, the server started, and verification requests succeeded. But when we tried to settle our first payment—silence. The transaction failed before it even hit the chain.

## The Problem

After digging through logs and tracing the transaction flow, we found the issue: **every transaction was being sent with only 24,000 gas units**.

For context:
- A simple ETH transfer needs ~21,000 gas
- A basic ERC-20 transfer needs ~65,000 gas
- An EIP-3009 `transferWithAuthorization` (with signature verification) needs ~100,000+ gas

We were trying to execute complex smart contract calls with barely enough gas for a simple transfer. Every settlement was doomed from the start.

## Finding the Root Cause

The 24,000 gas wasn't coming from our code—it was coming from QIE's `eth_estimateGas` RPC endpoint.

Here's how gas estimation typically works:

```
Your App → Viem → eth_estimateGas RPC → Returns estimated gas → Transaction sent
```

Viem, like most Ethereum libraries, calls `eth_estimateGas` before sending transactions. It's the responsible thing to do—you don't want to overpay for gas or have transactions fail due to insufficient gas.

But QIE's implementation was returning 24,000 for everything. Whether you were doing a simple transfer or a complex multi-step contract call, you got 24,000.

This is a known issue with some EVM-compatible chains. The gas estimation logic doesn't always match the actual execution requirements, especially for newer EIP standards like EIP-3009.

## The Challenge: No Configuration Options

"Just set a higher gas limit"—that was my first thought. But here's where it got tricky.

**The x402 library doesn't expose gas configuration.**

Looking at the `FacilitatorEvmSigner` interface from x402:

```typescript
type FacilitatorEvmSigner = {
  writeContract(args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<`0x${string}`>;

  sendTransaction(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<`0x${string}`>;

  // ... other methods
};
```

Notice what's missing? There's no `gas` parameter. The interface simply doesn't support it.

**Viem doesn't have a global gas override either.**

You can pass `gas` to individual transaction calls, but there's no "always use this gas limit" configuration. Viem is designed to be smart about gas estimation, not to work around broken RPCs.

So we were stuck between:
- A library (x402) that doesn't expose gas options
- An underlying library (Viem) that does accept gas but gets called internally by x402
- An RPC endpoint returning useless estimates

## The Solution: Intercepting at the Right Layer

The key insight was that while x402's interface doesn't include gas parameters, **Viem's actual methods do accept them**. x402 just passes through to Viem without the gas parameter.

We needed to intercept the calls between x402 and Viem.

### The Wrapper Pattern

Instead of modifying x402 or Viem (which would mean forking dependencies), we created a thin wrapper around the Viem client:

```typescript
// The gas limit that actually works for our transactions
const FIXED_GAS_LIMIT = 1_000_000n;

// Original Viem client
const client = createWalletClient({
  account,
  chain: qieChain,
  transport: http(),
}).extend(publicActions);

// Wrapper that injects gas into every transaction
const gasInjectedClient = {
  ...client,
  writeContract: (args: Parameters<typeof client.writeContract>[0]) =>
    client.writeContract({ ...args, gas: FIXED_GAS_LIMIT }),
  sendTransaction: (args: Parameters<typeof client.sendTransaction>[0]) =>
    client.sendTransaction({ ...args, gas: FIXED_GAS_LIMIT }),
};

// Pass the wrapper to x402 instead of the raw client
const evmSigner = toFacilitatorEvmSigner(
  gasInjectedClient as unknown as Parameters<typeof toFacilitatorEvmSigner>[0]
);
```

### How It Works

1. We spread all properties from the original client (`...client`), preserving every method and property
2. We override just `writeContract` and `sendTransaction`
3. Our overridden methods accept the same arguments as the originals
4. Before calling the real method, we spread the args and add our `gas` parameter
5. The `gas` parameter tells Viem to skip estimation and use our value

When x402 calls `writeContract`, it goes through our wrapper:

```
x402 → Our Wrapper (adds gas: 1_000_000n) → Viem → Transaction sent with correct gas
```

The broken `eth_estimateGas` call never happens because Viem sees that gas is already specified.

### Why This Works

JavaScript's object spread and method overriding made this possible:

```typescript
const original = {
  method1: () => "original",
  method2: () => "original"
};

const wrapped = {
  ...original,
  method1: () => "wrapped"
};

wrapped.method1(); // "wrapped"
wrapped.method2(); // "original"
```

We're not modifying any library code. We're creating a new object that behaves like the original but intercepts specific method calls. The type system complains a bit (hence the `as unknown as` cast), but at runtime it works perfectly.

## The Result

After implementing the wrapper:
- Settlement transactions now succeed consistently
- Gas usage is reasonable (we use less than 1M, but have headroom)
- No library modifications required
- Easy to adjust if needed (just change `FIXED_GAS_LIMIT`)

## Key Takeaways

### 1. Gas Estimation Is Not Guaranteed
Different chains implement `eth_estimateGas` differently. Some are accurate, some are not. When working with newer chains or L2s, always verify that gas estimation works correctly for your use case.

### 2. The Wrapper Pattern Is Powerful
When you can't modify a dependency's behavior through configuration, intercepting at the integration layer is often the cleanest solution. You get control without the maintenance burden of forking.

### 3. TypeScript Types Are Guides, Not Walls
The `FacilitatorEvmSigner` interface didn't include gas parameters, but the underlying implementation (Viem) supported them. Types tell you what a library expects, not what it can handle.

### 4. Debug at the RPC Level
When blockchain transactions fail mysteriously, check what's actually being sent to the RPC. Tools like logging middleware or RPC proxies can reveal issues that application-level debugging misses.

## Final Thoughts

This bug took hours to diagnose but minutes to fix. The real challenge wasn't the code—it was understanding where the problem actually lived. Gas estimation failure in the RPC? Not something you'd immediately suspect when your transactions keep failing.

The wrapper pattern saved us from forking dependencies, and it's a technique I'll keep in my toolkit. Sometimes the best fix isn't changing the broken thing—it's intercepting before you get there.

---

*Have you encountered similar issues with gas estimation on EVM chains? I'd love to hear your war stories and solutions.*
