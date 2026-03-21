/**
 * Stores last-known TON balance per user for deposit notification (optional).
 */

import { getRedisClient, redisKey } from "./redis.js";

function key(platform: string, userId: string): string {
  return redisKey(["last_balance", platform, userId]);
}

export interface LastBalance {
  balanceNano: string;
  lastCheckedAt: number;
}

export async function getLastBalance(
  platform: string,
  userId: string
): Promise<LastBalance | undefined> {
  const client = await getRedisClient();
  const raw = await client.get(key(platform, userId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as LastBalance;
  } catch {
    return undefined;
  }
}

export async function setLastBalance(
  platform: string,
  userId: string,
  snapshot: { balanceNano: string }
): Promise<void> {
  const client = await getRedisClient();
  await client.set(
    key(platform, userId),
    JSON.stringify({
      balanceNano: snapshot.balanceNano,
      lastCheckedAt: Date.now(),
    } as LastBalance)
  );
}
