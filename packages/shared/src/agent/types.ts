/**
 * Context passed from the bot into the agent (user's address, callbacks).
 */
export interface AgentContext {
  defaultAddress?: string;
  notifyUserId?: string;
  notifyPlatform?: string;
  onPrepareTransfer?: (params: {
    amountTon: string;
    amountNano: string;
    recipientAddress: string;
  }) => void;
}
