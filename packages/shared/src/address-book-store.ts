/**
 * Redis-backed address book: label -> TON address per user.
 * Used for "Send 10 TON to Exchange" by resolving "Exchange" to the saved address.
 */

import { getRedisClient, redisKey } from "./redis.js";

export interface AddressBookEntry {
  label: string;
  address: string;
}

const MAX_ENTRIES = 20;
const MAX_LABEL_LENGTH = 64;

function storeKey(platform: string, userId: string): string {
  return redisKey(["address_book", platform, userId]);
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export async function getAddressBook(
  platform: string,
  userId: string
): Promise<AddressBookEntry[]> {
  const client = await getRedisClient();
  const raw = await client.get(storeKey(platform, userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AddressBookEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getAddressByLabel(
  platform: string,
  userId: string,
  label: string
): Promise<string | undefined> {
  const book = await getAddressBook(platform, userId);
  const normalized = normalizeLabel(label);
  const entry = book.find((e) => normalizeLabel(e.label) === normalized);
  return entry?.address;
}

export async function addAddress(
  platform: string,
  userId: string,
  label: string,
  address: string
): Promise<{ ok: true } | { error: string }> {
  const trimmedLabel = label.trim();
  const trimmedAddress = address.trim();
  if (!trimmedLabel) return { error: "Label cannot be empty." };
  if (trimmedLabel.length > MAX_LABEL_LENGTH) {
    return { error: `Label must be at most ${MAX_LABEL_LENGTH} characters.` };
  }
  if (!trimmedAddress) return { error: "Address cannot be empty." };

  const client = await getRedisClient();
  const key = storeKey(platform, userId);
  let book = await getAddressBook(platform, userId);

  const normalized = normalizeLabel(trimmedLabel);
  const existingIndex = book.findIndex((e) => normalizeLabel(e.label) === normalized);
  if (existingIndex >= 0) {
    book[existingIndex] = { label: trimmedLabel, address: trimmedAddress };
  } else {
    if (book.length >= MAX_ENTRIES) {
      return { error: `Address book is full (max ${MAX_ENTRIES} entries). Remove an entry first.` };
    }
    book = [...book, { label: trimmedLabel, address: trimmedAddress }];
  }

  await client.set(key, JSON.stringify(book));
  return { ok: true };
}

export async function removeAddress(
  platform: string,
  userId: string,
  label: string
): Promise<{ ok: true; removed: boolean } | { error: string }> {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) return { error: "Label cannot be empty." };

  const book = await getAddressBook(platform, userId);
  const normalized = normalizeLabel(trimmedLabel);
  const filtered = book.filter((e) => normalizeLabel(e.label) !== normalized);
  if (filtered.length === book.length) {
    return { ok: true, removed: false };
  }

  const client = await getRedisClient();
  const key = storeKey(platform, userId);
  await client.set(key, JSON.stringify(filtered));
  return { ok: true, removed: true };
}
