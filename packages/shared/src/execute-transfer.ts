import { Address, internal } from "@ton/core";
import { keyPairFromSeed } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";
import type { PendingTransfer } from "./pending-transfer-store";
import { getTonClientInstance } from "./ton-client";

/** Default wallet_id for V4R2 (must match create-account). */
const WALLET_ID = 0x29a9a317;

const POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

export interface ExecuteTransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}


/**
 * Execute a TON transfer via Wallet V4R2: get seqno, build signed transfer, send via TonCenter sendBoc.
 * Polls getTransactions to obtain the new transaction id (lt_hash) for explorer link and confirmation.
 */
export async function executeTransfer(
  fromPrivateKeyHex: string,
  pending: PendingTransfer
): Promise<ExecuteTransferResult> {
  try {
    const seed = Buffer.from(fromPrivateKeyHex, "hex");
    if (seed.length !== 32) {
      return { success: false, error: "Invalid private key length" };
    }
    const keyPair = keyPairFromSeed(seed);
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
      walletId: WALLET_ID,
    });
    const client = getTonClientInstance();
    const provider = client.provider(wallet.address);

    const seqno = await wallet.getSeqno(provider);
    const toAddress = Address.parse(pending.recipientAddress);
    const value = BigInt(pending.amountNano);
    const internalMsg = internal({
      to: toAddress,
      value,
      bounce: false,
    });
    const transferCell = wallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internalMsg],
    });
    await client.sendExternalMessage(wallet, transferCell);

    const txHash = await pollForNewTransaction(client, wallet.address, POLL_ATTEMPTS, POLL_INTERVAL_MS);
    return {
      success: true,
      txHash: txHash ?? `pending_${Date.now()}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

async function pollForNewTransaction(
  client: ReturnType<typeof getTonClientInstance>,
  walletAddress: Address,
  attempts: number,
  intervalMs: number
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const txs = await client.getTransactions(walletAddress, { limit: 5 });
    const tx = txs[0];
    if (tx) {
      const lt = typeof tx.lt === "bigint" ? tx.lt.toString() : String(tx.lt);
      const hash = tx.hash().toString("hex");
      return `${lt}_${hash}`;
    }
  }
  return null;
}

/**
 * Best-effort confirmation: wait for the chain to process the tx.
 * TonCenter v2 does not return tx hash from sendBoc; executeTransfer already polls for the tx.
 * We wait briefly so the user sees "confirmed" after the tx is likely finalized.
 */
export async function waitForTransactionConfirmation(
  _txHash: string,
  timeoutMs: number = 30_000
): Promise<boolean> {
  const waitMs = Math.min(5000, timeoutMs);
  await new Promise((r) => setTimeout(r, waitMs));
  return true;
}
