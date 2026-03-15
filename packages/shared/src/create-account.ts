import { randomBytes } from "node:crypto";

export interface CreateAccountResult {
  address: string;
  privateKeyHex: string;
}

/**
 * Create a TON account: generate keypair and derive address.
 * Stub: returns a placeholder address. Replace with @ton/crypto + wallet contract for production.
 */
export async function createAccount(): Promise<CreateAccountResult> {
  const privateKeyHex = randomBytes(32).toString("hex");
  // TODO: use @ton/crypto keyPairFromSeed, then WalletContractV4 to get address
  const address = "EQ" + randomBytes(32).toString("hex").slice(0, 48) + "abc";
  return { address, privateKeyHex };
}
