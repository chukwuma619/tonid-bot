import { createTonClient, type TonClientStub } from "./ton-client";

export function createTonClientFromEnv(): TonClientStub {
  return createTonClient();
}

/** Get TON balance in nanotons for an address. */
export async function getTonBalance(address: string): Promise<bigint> {
  const client = createTonClient();
  return client.getBalance(address);
}

/** Format nanotons to TON string (e.g. "1.5"). */
export function formatTonFromNano(nano: bigint): string {
  const ton = Number(nano) / 1e9;
  if (ton >= 1) return ton.toFixed(2);
  if (ton >= 0.01) return ton.toFixed(4);
  return ton.toFixed(6);
}
