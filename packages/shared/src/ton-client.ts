/**
 * TON client: balance and (later) RPC. Stub implementation for scaffold.
 * Replace with @ton/ton + TonClient for production.
 */

export interface TonClientStub {
  getBalance(address: string): Promise<bigint>;
}

export function createTonClient(): TonClientStub {
  return {
    async getBalance(_address: string): Promise<bigint> {
      // TODO: use @ton/ton TonClient to fetch balance from TON RPC
      return 0n;
    },
  };
}
