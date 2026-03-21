/**
 * Redis-backed transaction history per user (outgoing TON sends).
 */

import { getRedisClient, redisKey } from "./redis";
import type { PendingTransfer } from "./pending-transfer-store";

export type TransactionHistoryEntry = {
  txHash: string;
  type: "send_ton";
  amount: string;
  asset: string;
  recipientAddress: string;
  timestamp: number;
};

const MAX_ENTRIES = 100;
const STORAGE_KEY = "tx_history";

function storeKey(platform: string, userId: string): string {
  return redisKey([STORAGE_KEY, platform, userId]);
}

export async function addTransaction(
  platform: string,
  userId: string,
  entry: TransactionHistoryEntry
): Promise<void> {
  const client = await getRedisClient();
  const key = storeKey(platform, userId);
  const raw = await client.get(key);
  let list: TransactionHistoryEntry[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as TransactionHistoryEntry[];
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  }
  list.unshift(entry);
  if (list.length > MAX_ENTRIES) {
    list = list.slice(0, MAX_ENTRIES);
  }
  await client.set(key, JSON.stringify(list));
}

export function buildHistoryEntry(pending: PendingTransfer, txHash: string): TransactionHistoryEntry {
  return {
    txHash,
    type: "send_ton",
    amount: pending.amountTon,
    asset: "TON",
    recipientAddress: pending.recipientAddress,
    timestamp: Date.now(),
  };
}

export async function getTransactionHistory(
  platform: string,
  userId: string
): Promise<TransactionHistoryEntry[]> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TransactionHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
