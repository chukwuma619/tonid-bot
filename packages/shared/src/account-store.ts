/**
 * Redis-backed store for bot-created TON accounts (platform + userId -> address, optional secretKey).
 * privateKeyHex is encrypted at rest when ENCRYPTION_KEY is set.
 */

import { getRedisClient, redisKey } from "./redis.js";
import { encrypt, decrypt, hasEncryptionKey } from "./encryption.js";

export interface StoredAccount {
  address: string;
  /** Present only for bot-created accounts; required to execute transfers. */
  privateKeyHex?: string;
}

function storeKey(platform: string, userId: string): string {
  return redisKey(["account", platform, userId]);
}

export async function setAccount(
  platform: string,
  userId: string,
  account: StoredAccount
): Promise<void> {
  const client = await getRedisClient();
  const payload: Record<string, string> = { address: account.address };
  if (account.privateKeyHex) {
    if (process.env.NODE_ENV === "production" && !hasEncryptionKey()) {
      throw new Error(
        "ENCRYPTION_KEY must be set in production to store private keys. Add a 32-byte hex key (64 chars) to your environment."
      );
    }
    payload.privateKeyHexEncrypted = encrypt(account.privateKeyHex);
  }
  await client.set(storeKey(platform, userId), JSON.stringify(payload));
}

export async function getAccount(
  platform: string,
  userId: string
): Promise<StoredAccount | undefined> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  if (!raw) return undefined;
  try {
    const data = JSON.parse(raw) as Record<string, string>;
    const result: StoredAccount = { address: data.address };
    if (data.privateKeyHexEncrypted) {
      result.privateKeyHex = decrypt(data.privateKeyHexEncrypted);
    }
    return result;
  } catch {
    return undefined;
  }
}

export async function listAccountUserIds(platform: string): Promise<string[]> {
  const client = await getRedisClient();
  const pattern = redisKey(["account", platform]) + ":*";
  const keys = await client.keys(pattern);
  const prefix = redisKey(["account", platform]) + ":";
  return keys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : "")).filter(Boolean);
}
