import { randomBytes, pbkdf2Sync } from "node:crypto";
import { getRedisClient, redisKey } from "./redis";

const PIN_SALT_BYTES = 16;
const PIN_ITERATIONS = 100_000;
const PIN_KEYLEN = 32;
const PIN_LENGTH = 6;

function storeKey(platform: string, userId: string): string {
  return redisKey(["pin", platform, userId]);
}

function normalizePin(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== PIN_LENGTH) return null;
  return digits;
}

function hashPin(pin: string, salt: Buffer): Buffer {
  return pbkdf2Sync(pin, salt, PIN_ITERATIONS, PIN_KEYLEN, "sha256");
}

export async function hasPin(platform: string, userId: string): Promise<boolean> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  return raw != null;
}

export async function setPin(
  platform: string,
  userId: string,
  rawPin: string
): Promise<{ ok: boolean; error?: string }> {
  const pin = normalizePin(rawPin);
  if (!pin) {
    return { ok: false, error: "PIN must be exactly 6 digits." };
  }
  const salt = randomBytes(PIN_SALT_BYTES);
  const hash = hashPin(pin, salt);
  const client = await getRedisClient();
  await client.set(
    storeKey(platform, userId),
    JSON.stringify({ saltHex: salt.toString("hex"), hashHex: hash.toString("hex") })
  );
  return { ok: true };
}

export async function verifyPin(
  platform: string,
  userId: string,
  rawPin: string
): Promise<boolean> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  if (!raw) return false;
  const pin = normalizePin(rawPin);
  if (!pin) return false;
  try {
    const stored = JSON.parse(raw) as { saltHex: string; hashHex: string };
    const salt = Buffer.from(stored.saltHex, "hex");
    const hash = hashPin(pin, salt);
    return Buffer.from(stored.hashHex, "hex").equals(hash);
  } catch {
    return false;
  }
}

export async function clearPin(platform: string, userId: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(storeKey(platform, userId));
}

export function looksLikePin(text: string): boolean {
  const t = text.trim();
  return t.length === PIN_LENGTH && /^\d+$/.test(t);
}
