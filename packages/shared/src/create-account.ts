import { randomBytes } from "node:crypto";
import { keyPairFromSeed } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

/** Default wallet_id for V4R2 (same for mainnet and testnet). */
const WALLET_ID = 0x29a9a317;

export interface CreateAccountResult {
  address: string;
  privateKeyHex: string;
}

/**
 * Create a TON account: generate keypair and derive Wallet V4R2 address.
 * Stores the 32-byte seed as privateKeyHex for use with keyPairFromSeed when signing.
 */
export async function createAccount(): Promise<CreateAccountResult> {
  const seed = randomBytes(32);
  const keyPair = keyPairFromSeed(seed);
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
    walletId: WALLET_ID,
  });
  const address = wallet.address.toString();
  const privateKeyHex = seed.toString("hex");
  return { address, privateKeyHex };
}
