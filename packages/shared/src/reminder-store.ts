/**
 * Scheduled reminders: "Remind me to send X TON every week". Notification-only (no auto-send).
 */

import { getRedisClient, redisKey } from "./redis.js";

export type ReminderInterval = "day" | "week" | "month";

export interface Reminder {
  id: string;
  platform: string;
  userId: string;
  amountTon?: number;
  recipientLabel?: string;
  interval: ReminderInterval;
  nextRunAt: number;
  createdAt: number;
}

const LIST_KEY_PREFIX = "reminders_list";
const ITEM_KEY_PREFIX = "reminder";

function listKey(platform: string, userId: string): string {
  return redisKey([LIST_KEY_PREFIX, platform, userId]);
}

function itemKey(id: string): string {
  return redisKey([ITEM_KEY_PREFIX, id]);
}

function nextId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addMs(interval: ReminderInterval): number {
  const day = 24 * 60 * 60 * 1000;
  switch (interval) {
    case "day":
      return day;
    case "week":
      return 7 * day;
    case "month":
      return 30 * day;
    default:
      return 7 * day;
  }
}

export async function addReminder(
  platform: string,
  userId: string,
  data: Omit<Reminder, "id" | "platform" | "userId" | "nextRunAt" | "createdAt"> & {
    interval: ReminderInterval;
  }
): Promise<Reminder> {
  const id = nextId();
  const now = Date.now();
  const reminder: Reminder = {
    id,
    platform,
    userId,
    amountTon: data.amountTon,
    recipientLabel: data.recipientLabel,
    interval: data.interval,
    nextRunAt: now + addMs(data.interval),
    createdAt: now,
  };
  const client = await getRedisClient();
  await client.set(itemKey(id), JSON.stringify(reminder));
  const listKeyStr = listKey(platform, userId);
  const raw = await client.get(listKeyStr);
  const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  ids.push(id);
  await client.set(listKeyStr, JSON.stringify(ids));
  return reminder;
}

export async function getReminders(
  platform: string,
  userId: string
): Promise<Reminder[]> {
  const client = await getRedisClient();
  const raw = await client.get(listKey(platform, userId));
  if (!raw) return [];
  const ids = JSON.parse(raw) as string[];
  const out: Reminder[] = [];
  for (const id of ids) {
    const item = await client.get(itemKey(id));
    if (item) {
      try {
        out.push(JSON.parse(item) as Reminder);
      } catch {
        // skip
      }
    }
  }
  out.sort((a, b) => a.nextRunAt - b.nextRunAt);
  return out;
}

export async function getReminderById(id: string): Promise<Reminder | undefined> {
  const client = await getRedisClient();
  const raw = await client.get(itemKey(id));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Reminder;
  } catch {
    return undefined;
  }
}

export async function deleteReminder(
  platform: string,
  userId: string,
  id: string
): Promise<boolean> {
  const client = await getRedisClient();
  const listKeyStr = listKey(platform, userId);
  const raw = await client.get(listKeyStr);
  if (!raw) return false;
  const ids = JSON.parse(raw) as string[];
  const idx = ids.indexOf(id);
  if (idx === -1) return false;
  ids.splice(idx, 1);
  await client.set(listKeyStr, JSON.stringify(ids));
  await client.del(itemKey(id));
  return true;
}

export async function getDueReminders(platform: string): Promise<Reminder[]> {
  const client = await getRedisClient();
  const pattern = redisKey([LIST_KEY_PREFIX, platform]) + ":*";
  const keys = await client.keys(pattern);
  const now = Date.now();
  const due: Reminder[] = [];
  for (const k of keys) {
    const raw = await client.get(k);
    if (!raw) continue;
    const ids = JSON.parse(raw) as string[];
    for (const id of ids) {
      const item = await client.get(itemKey(id));
      if (!item) continue;
      try {
        const r = JSON.parse(item) as Reminder;
        if (r.nextRunAt <= now) due.push(r);
      } catch {
        // skip
      }
    }
  }
  return due;
}

export async function advanceReminderNextRun(reminder: Reminder): Promise<void> {
  const client = await getRedisClient();
  const next = {
    ...reminder,
    nextRunAt: reminder.nextRunAt + addMs(reminder.interval),
  };
  await client.set(itemKey(reminder.id), JSON.stringify(next));
}
