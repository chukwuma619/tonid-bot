/**
 * AI agent for natural-language TON wallet commands.
 * Stub: returns a short message. Wire up AI SDK + TON tools for production.
 */
import type { AgentContext } from "./types.js";

export type { AgentContext } from "./types.js";

export async function runAgent(
  userMessage: string,
  _context?: AgentContext
): Promise<string> {
  // TODO: use AI SDK (generateText) with TON tools: get_balance, get_address_book,
  // add_address_book_entry, remove_address_book_entry, prepare_transfer
  const lower = userMessage.trim().toLowerCase();
  if (lower.includes("balance") || lower.includes("how much")) {
    return "Use **/balance** to see your TON balance, or **/address** to get your wallet address.";
  }
  if (lower.includes("send") || lower.includes("transfer")) {
    return "Use **/menu** → Send, or say e.g. _Send 1 TON to &lt;address&gt;_ and I’ll help you confirm.";
  }
  return "I’m your TON wallet assistant. Use **/menu** for Balance, Address, Send, History, and Settings. You can also ask things like “What’s my balance?” or “Send 1 TON to …”.";
}
