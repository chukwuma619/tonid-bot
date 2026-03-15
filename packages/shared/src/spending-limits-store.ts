/**
 * Spending limits: per-transfer cap, daily cap, whitelist-only, large-send confirmation.
 * Amounts in TON (number). Daily spent tracked per UTC day.
 */

import { getRedisClient, redisKey } from "./redis";
import type { PendingTransfer } from "./pending-transfer-store";

export interface SpendingLimits {
  perTransferMaxTon?: number;
  dailyMaxTon?: number;
  whitelistOnly?: boolean;
  largeSendThresholdTon?: number;
}

const LIMITS_KEY = "spending_limits";
const DAILY_SPENT_PREFIX = "daily_spent";
const AWAITING_LARGE_KEY = "awaiting_large_confirm";

function limitsKey(platform: string, userId: string): string {
  return redisKey([LIMITS_KEY, platform, userId]);
}

function dailySpentKey(platform: string, userId: string): string {
  const date = new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return redisKey([DAILY_SPENT_PREFIX, platform, userId, `${y}-${m}-${d}`]);
}

function awaitingLargeKey(platform: string, userId: string): string {
  return redisKey([AWAITING_LARGE_KEY, platform, userId]);
}

export async function getSpendingLimits(
  platform: string,
  userId: string
): Promise<SpendingLimits> {
  const client = await getRedisClient();
  const raw = await client.get(limitsKey(platform, userId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as SpendingLimits;
    return {
      perTransferMaxTon: parsed.perTransferMaxTon,
      dailyMaxTon: parsed.dailyMaxTon,
      whitelistOnly: parsed.whitelistOnly === true,
      largeSendThresholdTon: parsed.largeSendThresholdTon,
    };
  } catch {
    return {};
  }
}

export async function setSpendingLimits(
  platform: string,
  userId: string,
  update: Partial<SpendingLimits>
): Promise<void> {
  const current = await getSpendingLimits(platform, userId);
  const next: SpendingLimits = { ...current, ...update };
  const client = await getRedisClient();
  await client.set(limitsKey(platform, userId), JSON.stringify(next));
}

export async function getDailySpentTon(
  platform: string,
  userId: string
): Promise<number> {
  const client = await getRedisClient();
  const raw = await client.get(dailySpentKey(platform, userId));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function addDailySpentTon(
  platform: string,
  userId: string,
  amountTon: number
): Promise<void> {
  if (amountTon <= 0) return;
  const client = await getRedisClient();
  const key = dailySpentKey(platform, userId);
  const current = await getDailySpentTon(platform, userId);
  await client.set(key, String(current + amountTon));
}

export async function getAwaitingLargeConfirm(
  platform: string,
  userId: string
): Promise<boolean> {
  const client = await getRedisClient();
  const v = await client.get(awaitingLargeKey(platform, userId));
  return v === "1";
}

export async function setAwaitingLargeConfirm(
  platform: string,
  userId: string
): Promise<void> {
  const client = await getRedisClient();
  await client.set(awaitingLargeKey(platform, userId), "1");
}

export async function clearAwaitingLargeConfirm(
  platform: string,
  userId: string
): Promise<void> {
  const client = await getRedisClient();
  await client.del(awaitingLargeKey(platform, userId));
}

export interface CheckSpendingLimitsInput {
  amountTon?: number;
  recipientAddress: string;
  asset: "TON";
}

function normalizeAddress(addr: string): string {
  return addr.trim();
}

function isRecipientInWhitelist(
  recipientAddress: string,
  addressesInBook: string[]
): boolean {
  const normalized = normalizeAddress(recipientAddress);
  return addressesInBook.some((a) => normalizeAddress(a) === normalized);
}

export async function checkSpendingLimits(
  platform: string,
  userId: string,
  input: CheckSpendingLimitsInput,
  addressesInBook: string[]
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const limits = await getSpendingLimits(platform, userId);

  if (limits.whitelistOnly && addressesInBook.length > 0) {
    if (!isRecipientInWhitelist(input.recipientAddress, addressesInBook)) {
      return {
        allowed: false,
        reason:
          "Whitelist-only mode is on. You can only send to addresses in your address book. Add this address first, or turn off whitelist-only in **/limits**.",
      };
    }
  }

  if (input.amountTon != null && input.amountTon > 0) {
    if (
      limits.perTransferMaxTon != null &&
      Number.isFinite(limits.perTransferMaxTon) &&
      input.amountTon > limits.perTransferMaxTon
    ) {
      return {
        allowed: false,
        reason: `This transfer (${input.amountTon} TON) exceeds your per-transfer limit (${limits.perTransferMaxTon} TON). Adjust in **/limits** or send a smaller amount.`,
      };
    }

    if (
      limits.dailyMaxTon != null &&
      Number.isFinite(limits.dailyMaxTon) &&
      limits.dailyMaxTon > 0
    ) {
      const spent = await getDailySpentTon(platform, userId);
      const after = spent + input.amountTon;
      if (after > limits.dailyMaxTon) {
        const remaining = Math.max(0, limits.dailyMaxTon - spent);
        return {
          allowed: false,
          reason: `This would exceed your daily limit (${limits.dailyMaxTon} TON). You have ${remaining.toFixed(2)} TON left today. Resets at midnight UTC.`,
        };
      }
    }
  }

  return { allowed: true };
}

export function pendingToCheckInput(pending: PendingTransfer): CheckSpendingLimitsInput {
  return {
    amountTon: Number(pending.amountTon),
    recipientAddress: pending.recipientAddress,
    asset: "TON",
  };
}

export async function isAboveLargeSendThreshold(
  platform: string,
  userId: string,
  pending: PendingTransfer
): Promise<boolean> {
  const limits = await getSpendingLimits(platform, userId);
  const threshold = limits.largeSendThresholdTon;
  if (threshold == null || !Number.isFinite(threshold) || threshold <= 0) return false;
  return Number(pending.amountTon) > threshold;
}
