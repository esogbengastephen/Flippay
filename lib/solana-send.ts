import type { Connection, Keypair, Transaction } from "@solana/web3.js";

/**
 * Wraps sendAndConfirmTransaction. If the client's confirmation waiter loses the race
 * (RPC slow / websocket lag), web3.js throws "Signature … has expired: block height exceeded"
 * even though the transaction may already be on-chain. We re-query status and return the
 * signature when the ledger shows success so users are not shown a false failure.
 */
export async function sendAndConfirmTransactionWithExpiryRecovery(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[]
): Promise<string> {
  const { sendAndConfirmTransaction } = await import("@solana/web3.js");

  try {
    return await sendAndConfirmTransaction(connection, transaction, signers);
  } catch (e: unknown) {
    const signature = getSignatureFromConfirmationRaceError(e);
    if (!signature) throw e;

    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const st = value[0];
    if (st && !st.err) {
      return signature;
    }

    const landed = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (landed?.meta?.err == null && landed.transaction) {
      return signature;
    }

    throw e;
  }
}

function getSignatureFromConfirmationRaceError(e: unknown): string | null {
  if (typeof e !== "object" || e === null) return null;
  const name = (e as Error).name;
  if (
    name !== "TransactionExpiredBlockheightExceededError" &&
    name !== "TransactionExpiredTimeoutError"
  ) {
    return null;
  }
  const sig = (e as { signature?: unknown }).signature;
  return typeof sig === "string" ? sig : null;
}
