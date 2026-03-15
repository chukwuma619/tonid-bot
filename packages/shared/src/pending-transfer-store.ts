/**
 * In-memory store for pending TON transfers (awaiting user confirmation).
 */

export interface PendingTransfer {
  asset: "TON";
  /** Amount in nanotons (1 TON = 1e9 nanotons). */
  amountNano: string;
  /** Human-readable amount for display (e.g. "1.5"). */
  amountTon: string;
  recipientAddress: string;
  createdAt: number;
}

export function isPendingTonTransfer(p: PendingTransfer): p is PendingTransfer {
  return p.asset === "TON";
}

const store = new Map<string, PendingTransfer>();

function key(platform: string, userId: string): string {
  return `${platform}:${userId}`;
}

export function setPendingTransfer(
  platform: string,
  userId: string,
  data: Omit<PendingTransfer, "createdAt">
): void {
  store.set(key(platform, userId), { ...data, createdAt: Date.now() });
}

export function getPendingTransfer(
  platform: string,
  userId: string
): PendingTransfer | undefined {
  return store.get(key(platform, userId));
}

export function clearPendingTransfer(platform: string, userId: string): void {
  store.delete(key(platform, userId));
}
