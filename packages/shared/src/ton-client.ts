/**
 * TON client: balance and RPC via TonCenter API v2.
 * Uses @ton/ton TonClient (HTTP) for getBalance; runMethod and send use the same client.
 */

import { Address } from "@ton/core";
import { TonClient } from "@ton/ton";

function getTonEndpoint(): string {
  let url = (process.env.TON_RPC_URL ?? "https://toncenter.com/api/v2/jsonRPC").trim().replace(/\/$/, "");

  if (process.env.TON_NETWORK === "testnet" && url.includes("toncenter.com") && !url.includes("testnet")) {
    url = url.replace("https://toncenter.com", "https://testnet.toncenter.com");
  }

  if (!/\/jsonRPC$/i.test(url)) {
    if (/\/api\/v2$/i.test(url)) {
      url = `${url}/jsonRPC`;
    }
  }

  return url;
}

let clientInstance: TonClient | null = null;

function getTonClient(): TonClient {
  if (!clientInstance) {
    const endpoint = getTonEndpoint();
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
