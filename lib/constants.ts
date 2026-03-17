// Base Network Configuration
export const BASE_CHAIN_ID = 8453;
// Avoid mainnet.base.org — it enforces strict 429 rate limits which cause "Failed to fetch" in ethers.js.
// Priority: custom RPC → llamarpc fallback (override with NEXT_PUBLIC_BASE_RPC_URL if needed).
const _configuredRpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || "";
export const BASE_RPC_URL =
  // If the configured URL is the strict official node, swap it out for a more permissive public RPC.
  _configuredRpc && _configuredRpc !== "https://mainnet.base.org"
    ? _configuredRpc
    : "https://base.llamarpc.com";

// $SEND Token Contract Address
export const SEND_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS ||
  "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

// Exchange Rate (default, should be fetched from API)
export const DEFAULT_EXCHANGE_RATE = parseFloat(
  process.env.SEND_NGN_EXCHANGE_RATE || "50"
);

// Deposit Account Information
export const DEPOSIT_ACCOUNT = {
  name: "Flipbridge Digital Limited",
  accountNumber: "6565315226",
  bank: "Moniepoint MFB",
};

// Paystack Dummy Email (prevents Paystack from sending emails to users)
// Real user emails are stored in Paystack customer metadata
export const PAYSTACK_DUMMY_EMAIL = "payments@flippay.app";

/**
 * Generate unique Paystack email for a user
 * Format: flippay.{userEmail}
 * Example: user@example.com → flippay.user@example.com
 * This ensures each user has a unique email in Paystack while still being a dummy email
 */
export function getPaystackEmailForUser(userEmail: string): string {
  return `flippay.${userEmail}`;
}

