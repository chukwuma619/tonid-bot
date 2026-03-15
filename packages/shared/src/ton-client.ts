/**
 * TON client: balance and RPC via TonCenter API v2.
 * Uses @ton/ton TonClient (HTTP) for getBalance; runMethod and send use the same client.
 */

import { Address } from "@ton/core";
import { TonClient } from "@ton/ton";

/** Base URL for TonCenter API v2 (e.g. https://toncenter.com/api/v2 or https://testnet.toncenter.com/api/v2). */
function getTonApiBase(): string {
  const url = process.env.TON_RPC_URL ?? "https://toncenter.com/api/v2/jsonRPC";
  const base = url.replace(/\/jsonRPC\/?$/i, "");
  if (process.env.TON_NETWORK === "testnet" && base.includes("toncenter.com") && !base.includes("testnet")) {
    return base.replace("https://toncenter.com", "https://testnet.toncenter.com");
  }
  return base;
}

let clientInstance: TonClient | null = null;

function getTonClient(): TonClient {
  if (!clientInstance) {
    const endpoint = getTonApiBase();
    clientInstance = new TonClient({
      endpoint,
      apiKey: process.env.TON_API_KEY,
    });
  }
  return clientInstance;
}

export interface TonClientStub {
  getBalance(address: string): Promise<bigint>;
}

export function createTonClient(): TonClientStub {
  const client = getTonClient();
  return {
    async getBalance(address: string): Promise<bigint> {
      const addr = Address.parse(address);
      return client.getBalance(addr);
    },
  };
}

/** Get the underlying TonClient for runMethod, sendExternalMessage, getTransactions. */
export function getTonClientInstance(): TonClient {
  return getTonClient();
}
