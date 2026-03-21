import { getRedisClient, redisKey } from "./redis.js";
import type { PendingTransfer } from "./pending-transfer-store.js";

export type LastTransfer = Omit<PendingTransfer, "createdAt">;

const KEY_PREFIX = "last_transfer";

function storeKey(platform: string, userId: string): string {
  return redisKey([KEY_PREFIX, platform, userId]);
}

export async function setLastTransfer(
  platform: string,
  userId: string,
  data: LastTransfer
): Promise<void> {
  const client = await getRedisClient();
  await client.set(storeKey(platform, userId), JSON.stringify(data));
}

export async function getLastTransfer(
  platform: string,
  userId: string
): Promise<LastTransfer | undefined> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as LastTransfer;
  } catch {
    return undefined;
  }
}
