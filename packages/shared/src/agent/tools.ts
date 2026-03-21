import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "./types.js";
import { getTonBalance, formatTonFromNano } from "../balance.js";
import {
  getAddressBook,
  getAddressByLabel,
  addAddress,
  removeAddress,
} from "../address-book-store.js";
import { getTransactionHistory } from "../transaction-history-store.js";
import {
  getSpendingLimits,
  setSpendingLimits,
  getDailySpentTon,
  checkSpendingLimits,
  getAwaitingLargeConfirm,
  setAwaitingLargeConfirm,
  clearAwaitingLargeConfirm,
  isAboveLargeSendThreshold,
  type SpendingLimits,
} from "../spending-limits-store.js";
import {
  addReminder,
  getReminders,
  deleteReminder,
  type ReminderInterval,
} from "../reminder-store.js";
import { fiatToTon, formatFiat, getTonPriceIn } from "../ton-price.js";

function looksLikeTonAddress(addr: string): boolean {
  const a = addr.trim();
  return a.startsWith("UQ") || a.startsWith("EQ");
}

function parseTonAmount(amount: number | string): { amountNano: string; amountTon: string } | { error: string } {
  const raw = typeof amount === "number" ? String(amount) : amount.trim().replace(/,/g, ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { error: "Amount must be a positive number." };
  const nano = BigInt(Math.round(n * 1e9));
  if (nano <= 0n) return { error: "Amount is too small." };
  return { amountNano: nano.toString(), amountTon: formatTonFromNano(nano) };
}

const amountSchema = z.union([z.number().positive(), z.string().min(1)]);

async function resolveRecipient(
  platform: string | undefined,
  userId: string | undefined,
  address: string | undefined,
  label: string | undefined
): Promise<{ address: string } | { error: string }> {
  if (address?.trim()) {
    const a = address.trim();
    if (!looksLikeTonAddress(a)) {
      return { error: `Invalid TON address. Use a friendly address starting with UQ or EQ, not: ${a.slice(0, 20)}…` };
    }
    return { address: a };
  }
  if (label?.trim() && platform && userId) {
    const resolved = await getAddressByLabel(platform, userId, label.trim());
    if (resolved) return { address: resolved };
    return {
      error: `No saved address for "${label.trim()}". Ask the user to add it ("Add ${label.trim()} as UQB...") or use a full TON address.`,
    };
  }
  return { error: "Provide either recipientAddress (UQ.../EQ...) or recipientLabel (saved name)." };
}

function buildTransferConfirmationMessage(details: { amount: string; recipient: string }): string {
  const net = process.env.TON_NETWORK === "mainnet" ? "TON mainnet" : "TON testnet";
  return (
    `Please confirm the transfer details:\n\n` +
    `• **Asset:** TON\n` +
    `• **Amount:** ${details.amount}\n` +
    `• **Recipient:** \`${details.recipient}\`\n` +
    `• **Network:** ${net}\n\n` +
    `Reply **Yes** to confirm. If you have a PIN set, you'll be asked to enter it to authorize.\n\n` +
    `To change details, say e.g. "Send 0.5 TON instead" or "Send to UQB…".\n\n` +
    `**Large sends:** If the bot says this exceeds your large-send threshold, reply **CONFIRM LARGE** once, then repeat your send request.`
  );
}

async function applyLargeSendGate(
  platform: string,
  userId: string,
  amountTon: number,
  recipientAddress: string,
  amountNano: string
): Promise<{ ok: true } | { error: string }> {
  const pendingLike = {
    asset: "TON" as const,
    amountNano,
    amountTon: String(amountTon),
    recipientAddress,
    createdAt: Date.now(),
  };
  const above = await isAboveLargeSendThreshold(platform, userId, pendingLike);
  if (!above) return { ok: true };
  const awaiting = await getAwaitingLargeConfirm(platform, userId);
  if (!awaiting) {
    await setAwaitingLargeConfirm(platform, userId);
    return {
      error:
        "This send is above your **large-send** threshold. Reply **CONFIRM LARGE** once, then ask again to send the same amount (e.g. repeat “Send X TON to …”).",
    };
  }
  await clearAwaitingLargeConfirm(platform, userId);
  return { ok: true };
}

export function createAgentTools(context?: AgentContext) {
  const get_balance = tool({
    description:
      "Get on-chain TON balance for the user's wallet. Use for 'what is my balance', 'how much TON'. Uses the user's default address from context unless another address is given.",
    inputSchema: z.object({
      address: z.string().optional().describe("TON friendly address (UQ.../EQ...); omit for the user's default wallet"),
    }),
    execute: async (params) => {
      const addr = params.address?.trim() || context?.defaultAddress;
      if (!addr) {
        return { error: "No wallet address. The user should use /start to create a wallet." };
      }
      if (!looksLikeTonAddress(addr)) {
        return { error: "Invalid TON address format (expected UQ... or EQ...)." };
      }
      try {
        const nano = await getTonBalance(addr);
        return {
          address: addr,
          balanceNano: nano.toString(),
          balanceTon: formatTonFromNano(nano),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Could not fetch balance: ${msg}` };
      }
    },
  });

  const get_address_book = tool({
    description: "List saved address book entries (label → TON address).",
    inputSchema: z.object({}),
    execute: async () => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Address book not available in this session." };
      }
      const book = await getAddressBook(context.notifyPlatform, context.notifyUserId);
      return { entries: book, message: book.length === 0 ? "Address book is empty." : undefined };
    },
  });

  const add_address_book_entry = tool({
    description:
      "Add a TON address under a label. E.g. user says 'Add Exchange as UQB...'.",
    inputSchema: z.object({
      label: z.string().min(1),
      address: z.string().min(1),
    }),
    execute: async (params) => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Address book not available in this session." };
      }
      if (!looksLikeTonAddress(params.address)) {
        return { error: "Address must be a TON friendly address (UQ... or EQ...)." };
      }
      const result = await addAddress(context.notifyPlatform, context.notifyUserId, params.label, params.address.trim());
      if ("error" in result) return result;
      return { ok: true, message: `Added "${params.label}" to your address book.` };
    },
  });

  const remove_address_book_entry = tool({
    description: "Remove an address book entry by label.",
    inputSchema: z.object({ label: z.string().min(1) }),
    execute: async (params) => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Address book not available in this session." };
      }
      const result = await removeAddress(context.notifyPlatform, context.notifyUserId, params.label);
      if ("error" in result) return result;
      return {
        ok: true,
        removed: result.removed,
        message: result.removed
          ? `Removed "${params.label}" from your address book.`
          : `No entry named "${params.label}" in your address book.`,
      };
    },
  });

  const get_transaction_history = tool({
    description: "Recent outgoing TON transfers for this user.",
    inputSchema: z.object({
      limit: z.number().min(1).max(50).optional().default(15),
    }),
    execute: async (params) => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "History not available in this session." };
      }
      const all = await getTransactionHistory(context.notifyPlatform, context.notifyUserId);
      const entries = all.slice(0, params.limit);
      const explorerBase = (process.env.TON_EXPLORER_URL ?? "").replace(/\/$/, "");
      const formatted = entries.map((e) => {
        const date = new Date(e.timestamp).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        });
        const txLink = explorerBase ? `${explorerBase}/tx/${e.txHash}` : e.txHash;
        return {
          amount: `${e.amount} ${e.asset}`,
          recipient: e.recipientAddress,
          date,
          txHash: e.txHash,
          txLink,
        };
      });
      return {
        entries: formatted,
        message: entries.length === 0 ? "No outgoing transactions recorded yet." : undefined,
      };
    },
  });

  const get_spending_limits = tool({
    description: "View spending limits and TON spent today (UTC).",
    inputSchema: z.object({}),
    execute: async () => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Limits not available in this session." };
      }
      const [limits, spentToday] = await Promise.all([
        getSpendingLimits(context.notifyPlatform, context.notifyUserId),
        getDailySpentTon(context.notifyPlatform, context.notifyUserId),
      ]);
      return {
        perTransferMaxTon: limits.perTransferMaxTon,
        dailyMaxTon: limits.dailyMaxTon,
        whitelistOnly: limits.whitelistOnly === true,
        largeSendThresholdTon: limits.largeSendThresholdTon,
        spentTodayTon: spentToday,
      };
    },
  });

  const set_spending_limits = tool({
    description:
      "Update spending limits (per-transfer max, daily max, whitelist-only, large-send threshold). Only include fields the user wants to change.",
    inputSchema: z.object({
      perTransferMaxTon: z.number().positive().optional(),
      dailyMaxTon: z.number().positive().optional(),
      whitelistOnly: z.boolean().optional(),
      largeSendThresholdTon: z.number().positive().optional(),
    }),
    execute: async (params) => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Limits not available in this session." };
      }
      const update: Partial<SpendingLimits> = {};
      if (params.perTransferMaxTon != null) update.perTransferMaxTon = params.perTransferMaxTon;
      if (params.dailyMaxTon != null) update.dailyMaxTon = params.dailyMaxTon;
      if (params.whitelistOnly != null) update.whitelistOnly = params.whitelistOnly;
      if (params.largeSendThresholdTon != null) update.largeSendThresholdTon = params.largeSendThresholdTon;
      if (Object.keys(update).length === 0) {
        return { error: "Provide at least one field to update." };
      }
      await setSpendingLimits(context.notifyPlatform, context.notifyUserId, update);
      const parts: string[] = [];
      if (update.perTransferMaxTon != null) parts.push(`per-transfer max: ${update.perTransferMaxTon} TON`);
      if (update.dailyMaxTon != null) parts.push(`daily max: ${update.dailyMaxTon} TON`);
      if (update.whitelistOnly != null) parts.push(`whitelist only: ${update.whitelistOnly ? "on" : "off"}`);
      if (update.largeSendThresholdTon != null) parts.push(`large-send threshold: ${update.largeSendThresholdTon} TON`);
      return { ok: true, message: `Updated: ${parts.join("; ")}. Use /limits to view.` };
    },
  });

  const get_reminders = tool({
    description: "List scheduled send reminders (notification-only).",
    inputSchema: z.object({}),
    execute: async () => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Reminders not available in this session." };
      }
      const reminders = await getReminders(context.notifyPlatform, context.notifyUserId);
      const formatted = reminders.map((r, i) => ({
        index: i + 1,
        id: r.id,
        amountTon: r.amountTon,
        recipientLabel: r.recipientLabel,
        interval: r.interval,
        nextRunAt: new Date(r.nextRunAt).toISOString(),
      }));
      return {
        reminders: formatted,
        message:
          reminders.length === 0
            ? "No reminders. E.g. _Remind me to send 1 TON every week_."
            : undefined,
      };
    },
  });

  const set_reminder = tool({
    description:
      "Create a reminder about sending TON (notifications only). Interval: day, week, or month.",
    inputSchema: z.object({
      amountTon: z.number().positive().optional(),
      recipientLabel: z.string().optional(),
      interval: z.enum(["day", "week", "month"]),
    }),
    execute: async (params) => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Reminders not available in this session." };
      }
      if (params.amountTon == null) {
        return { error: "Provide amountTon (e.g. remind me to send 1 TON every week)." };
      }
      const reminder = await addReminder(context.notifyPlatform, context.notifyUserId, {
        amountTon: params.amountTon,
        recipientLabel: params.recipientLabel,
        interval: params.interval as ReminderInterval,
      });
      return {
        ok: true,
        id: reminder.id,
        message: `Reminder set: ${params.amountTon} TON every ${params.interval}. Use /reminders to list. No auto-send.`,
      };
    },
  });

  const delete_reminder = tool({
    description: "Delete a reminder by id or 1-based index from the list.",
    inputSchema: z.object({
      reminderId: z.string().optional(),
      index: z.number().int().min(1).optional(),
    }),
    execute: async (params) => {
      if (!context?.notifyPlatform || !context?.notifyUserId) {
        return { error: "Reminders not available in this session." };
      }
      const reminders = await getReminders(context.notifyPlatform, context.notifyUserId);
      let id: string | undefined = params.reminderId;
      if (id == null && params.index != null) {
        id = reminders[params.index - 1]?.id;
      }
      if (!id) {
        return {
          error:
            reminders.length === 0
              ? "No reminders to delete."
              : "Provide reminderId or index (1-based). Use get_reminders to list.",
        };
      }
      const deleted = await deleteReminder(context.notifyPlatform, context.notifyUserId, id);
      return deleted
        ? { ok: true, message: "Reminder removed." }
        : { error: "Reminder not found or already deleted." };
    },
  });

  const prepare_transfer = tool({
    description:
      "Prepare a TON transfer. Use when the user wants to send TON to an address or saved label. After success, show the returned summary and tell them to reply Yes to confirm.",
    inputSchema: z.object({
      amountTon: amountSchema.describe("Amount in TON (e.g. 1 or 0.25)"),
      recipientAddress: z.string().optional(),
      recipientLabel: z.string().optional(),
    }),
    execute: async (params) => {
      if (!context?.defaultAddress) {
        return { error: "No wallet linked. User should use /start to create a wallet." };
      }
      if (!context.onPrepareTransfer) {
        return { error: "Transfer preparation is not available in this session." };
      }
      const parsed = parseTonAmount(params.amountTon);
      if ("error" in parsed) return parsed;
      const amountTonNum = Number(parsed.amountTon);
      const resolved = await resolveRecipient(
        context.notifyPlatform,
        context.notifyUserId,
        params.recipientAddress,
        params.recipientLabel
      );
      if ("error" in resolved) return resolved;

      if (context.notifyPlatform && context.notifyUserId) {
        const book = await getAddressBook(context.notifyPlatform, context.notifyUserId);
        const limitsCheck = await checkSpendingLimits(
          context.notifyPlatform,
          context.notifyUserId,
          { amountTon: amountTonNum, recipientAddress: resolved.address, asset: "TON" },
          book.map((e) => e.address)
        );
        if (!limitsCheck.allowed) return { error: limitsCheck.reason };

        const large = await applyLargeSendGate(
          context.notifyPlatform,
          context.notifyUserId,
          amountTonNum,
          resolved.address,
          parsed.amountNano
        );
        if ("error" in large) return large;
      }

      context.onPrepareTransfer({
        amountTon: parsed.amountTon,
        amountNano: parsed.amountNano,
        recipientAddress: resolved.address,
      });

      const usd = await getTonPriceIn("usd");
      const amountStr =
        usd && Number.isFinite(amountTonNum * usd.pricePerTon)
          ? `${parsed.amountTon} TON ($${(amountTonNum * usd.pricePerTon).toFixed(2)})`
          : `${parsed.amountTon} TON`;
      return { ok: true, summary: buildTransferConfirmationMessage({ amount: amountStr, recipient: resolved.address }) };
    },
  });

  const prepare_transfer_by_fiat = tool({
    description:
      "Prepare a TON transfer when the user specifies a fiat amount (e.g. send $20 worth of TON to Alice).",
    inputSchema: z.object({
      amount: z.number().positive(),
      currency: z.string().min(1),
      recipientAddress: z.string().optional(),
      recipientLabel: z.string().optional(),
    }),
    execute: async (params) => {
      if (!context?.defaultAddress) {
        return { error: "No wallet linked. User should use /start to create a wallet." };
      }
      if (!context.onPrepareTransfer) {
        return { error: "Transfer preparation is not available in this session." };
      }
      const resolved = await resolveRecipient(
        context.notifyPlatform,
        context.notifyUserId,
        params.recipientAddress,
        params.recipientLabel
      );
      if ("error" in resolved) return resolved;

      const converted = await fiatToTon(params.amount, params.currency);
      if (!converted) {
        return {
          error: "Could not fetch TON price for that currency. Try again or specify the amount in TON.",
        };
      }
      const amountTonRounded = Math.round(converted.amountTon * 1e6) / 1e6;
      if (amountTonRounded <= 0) {
        return { error: "Computed TON amount is too small. Try a larger fiat amount." };
      }
      const nano = BigInt(Math.round(amountTonRounded * 1e9));
      const amountTonStr = formatTonFromNano(nano);

      if (context.notifyPlatform && context.notifyUserId) {
        const book = await getAddressBook(context.notifyPlatform, context.notifyUserId);
        const limitsCheck = await checkSpendingLimits(
          context.notifyPlatform,
          context.notifyUserId,
          { amountTon: amountTonRounded, recipientAddress: resolved.address, asset: "TON" },
          book.map((e) => e.address)
        );
        if (!limitsCheck.allowed) return { error: limitsCheck.reason };

        const large = await applyLargeSendGate(
          context.notifyPlatform,
          context.notifyUserId,
          amountTonRounded,
          resolved.address,
          nano.toString()
        );
        if ("error" in large) return large;
      }

      context.onPrepareTransfer({
        amountTon: amountTonStr,
        amountNano: nano.toString(),
        recipientAddress: resolved.address,
      });

      const formatted = formatFiat(params.amount, params.currency);
      const summary = buildTransferConfirmationMessage({
        amount: `${formatted} ≈ ${amountTonStr} TON`,
        recipient: resolved.address,
      });
      return {
        ok: true,
        amountFiat: params.amount,
        currency: converted.currency,
        amountTon: amountTonStr,
        pricePerTon: converted.pricePerTon,
        summary,
      };
    },
  });

  const convert_or_swap = tool({
    description: "Explain how to swap TON or other tokens using TON DEXes; do not execute swaps.",
    inputSchema: z.object({
      fromAsset: z.string().optional(),
      toAsset: z.string().optional(),
    }),
    execute: async () => {
      const address = context?.defaultAddress;
      const hint =
        "Swap TON and jettons on TON using a DEX such as [STON.fi](https://ston.fi) or [DeDust](https://dedust.io). Connect a wallet and send/receive using your TON address.";
      const addrLine = address ? `Your TON receive address: \`${address}\`` : "Use /start to create a wallet and get a receive address.";
      return { ok: true, message: `${hint}\n\n${addrLine}` };
    },
  });

  return {
    get_balance,
    get_address_book,
    add_address_book_entry,
    remove_address_book_entry,
    prepare_transfer,
    prepare_transfer_by_fiat,
    get_transaction_history,
    get_spending_limits,
    set_spending_limits,
    get_reminders,
    set_reminder,
    delete_reminder,
    convert_or_swap,
  };
}
