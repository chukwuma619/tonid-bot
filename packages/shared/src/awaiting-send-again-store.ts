import { getRedisClient, redisKey } from "./redis";

const KEY_PREFIX = "awaiting_send_again";

function storeKey(platform: string, userId: string): string {
  return redisKey([KEY_PREFIX, platform, userId]);
}

export interface AwaitingSendAgain {
  recipientAddress: string;
}

export async function setAwaitingSendAgain(
  platform: string,
  userId: string,
  data: AwaitingSendAgain
): Promise<void> {
  const client = await getRedisClient();
  await client.set(storeKey(platform, userId), JSON.stringify(data));
}

export async function getAwaitingSendAgain(
  platform: string,
  userId: string
): Promise<AwaitingSendAgain | undefined> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AwaitingSendAgain;
  } catch {
    return undefined;
  }
}

export async function clearAwaitingSendAgain(
  platform: string,
  userId: string
): Promise<void> {
  const client = await getRedisClient();
  await client.del(storeKey(platform, userId));
}
