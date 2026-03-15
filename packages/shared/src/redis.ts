import { createClient, type RedisClientType } from "redis";

const KEY_PREFIX = "tonid-bot:";

let client: RedisClientType | null = null;

export function redisKey(parts: string[]): string {
  return KEY_PREFIX + parts.join(":");
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (client) return client;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  client = createClient({ url });
  client.on("error", (err) => console.error("[redis]", err));
  await client.connect();
  return client;
}
