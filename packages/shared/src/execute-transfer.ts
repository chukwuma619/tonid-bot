import type { PendingTransfer } from "./pending-transfer-store";

export interface ExecuteTransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Execute a TON transfer. Stub: returns success with a placeholder tx hash.
 * Replace with @ton/ton WalletContractV4 + sendTransfer for production.
 */
export async function executeTransfer(
  _fromPrivateKeyHex: string,
  _pending: PendingTransfer
): Promise<ExecuteTransferResult> {
  // TODO: build and send TON transfer via wallet contract
  return {
    success: true,
    txHash: "placeholder_" + Date.now().toString(36),
  };
}

export async function waitForTransactionConfirmation(
  _txHash: string,
  _timeoutMs?: number
): Promise<boolean> {
  // TODO: poll TON explorer or RPC for confirmation
  return true;
}
