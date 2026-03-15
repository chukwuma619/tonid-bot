import { InlineKeyboard, type Bot, type Context } from "grammy";
import {
  getAccount,
  setAccount,
  getPendingTransfer,
  setPendingTransfer,
  clearPendingTransfer,
  getAwaitingPin,
  setAwaitingPin,
  clearAwaitingPin,
  incrementPinAttempts,
  MAX_PIN_ATTEMPTS,
  hasPin,
  setPin,
  verifyPin,
  looksLikePin,
  createAccount,
  runAgent,
  stripAnsi,
  getLastBalance,
  setLastBalance,
  getTonBalance,
  formatTonFromNano,
  getAddressBook,
  getTransactionHistory,
  addTransaction,
  buildHistoryEntry,
  getSpendingLimits,
  setSpendingLimits,
  getDailySpentTon,
  addDailySpentTon,
  getAwaitingLargeConfirm,
  setAwaitingLargeConfirm,
  clearAwaitingLargeConfirm,
  checkSpendingLimits,
  pendingToCheckInput,
  isAboveLargeSendThreshold,
  getLastTransfer,
  setLastTransfer,
  getAwaitingSendAgain,
  setAwaitingSendAgain,
  clearAwaitingSendAgain,
  getReminders,
  getDueReminders,
  advanceReminderNextRun,
  getAddressByLabel,
  addAddress,
  type StoredAccount,
  type AddressBookEntry,
  type PendingTransfer,
  type AgentContext,
  type AwaitingPinReason,
  type TransactionHistoryEntry,
  executeTransfer,
  waitForTransactionConfirmation,
} from "@tonid-bot/shared";

const PLATFORM = "telegram";

const DM_ONLY_MSG =
  "I only work in **direct messages**. Please open a private chat with me to continue.";
const SETUP_REQUIRED_MSG = "Set up your account first. Say **/start** to create a wallet.";

const threadState = new Map<string, { defaultAddress?: string }>();

function getUserId(ctx: Context): string {
  return String(ctx.from?.id ?? "");
}

function getState(userId: string) {
  return threadState.get(userId) ?? {};
}

function setState(userId: string, update: { defaultAddress?: string }) {
  const current = threadState.get(userId) ?? {};
  threadState.set(userId, { ...current, ...update });
}

function isConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "yes" || t === "y" || t === "confirm" || t === "ok" || t === "send";
}

function isConfirmLarge(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "confirm large" || t === "confirmlarge";
}

function formatTransferDetails(pending: PendingTransfer): string {
  return (
    `• **Amount:** ${pending.amountTon} TON\n` +
    `• **To:** \`${pending.recipientAddress}\``
  );
}

const explorerBase = (): string => process.env.TON_EXPLORER_URL ?? "https://tonscan.org";

function formatTransferProcessing(pending: PendingTransfer, txHash: string): string {
  return (
    "\u231B **Your transaction is being processed:**\n\n" +
    formatTransferDetails(pending) +
    "\n\n**Tx:** " +
    explorerBase() +
    "/tx/" +
    txHash +
    "\n\n_Confirmation may take a moment._"
  );
}

function formatTransferConfirmed(pending: PendingTransfer, txHash: string): string {
  return (
    "\u2705 **Transaction confirmed:**\n\n" +
    formatTransferDetails(pending) +
    "\n\n**Tx:** " +
    explorerBase() +
    "/tx/" +
    txHash
  );
}

const REMOVE_KEYBOARD = { remove_keyboard: true } as const;

async function sendProcessingThenConfirmed(
  pending: PendingTransfer,
  txHash: string,
  ctx: Context
): Promise<void> {
  const chatId = ctx.chat!.id;
  const userId = getUserId(ctx);
  const api = ctx.api;
  await ctx.reply(formatTransferProcessing(pending, txHash), {
    parse_mode: "Markdown",
    reply_markup: REMOVE_KEYBOARD,
  });
  void waitForTransactionConfirmation(txHash).then(async (confirmed: boolean) => {
    if (confirmed) {
      await setLastTransfer(PLATFORM, userId, {
        asset: "TON",
        amountNano: pending.amountNano,
        amountTon: pending.amountTon,
        recipientAddress: pending.recipientAddress,
      });
      const confirmedMsg = await api.sendMessage(
        chatId,
        formatTransferConfirmed(pending, txHash),
        { parse_mode: "Markdown" }
      );
      try {
        await api.setMessageReaction(chatId, confirmedMsg.message_id, [
          { type: "emoji", emoji: "👍" },
        ]);
      } catch {
        // ignore
      }
      const againKb = new InlineKeyboard()
        .text("Same amount", "again_same")
        .text("Same recipient", "again_recip")
        .row()
        .text("New transfer", "again_new");
      await api.sendMessage(chatId, "**Send again?**", {
        parse_mode: "Markdown",
        reply_markup: againKb,
      });
    } else {
      await api.sendMessage(
        chatId,
        `Transaction submitted. Check: ${explorerBase()}/tx/${txHash}`,
        { parse_mode: "Markdown" }
      );
    }
  });
}

async function processPinSubmission(
  userId: string,
  pin: string,
  reason: AwaitingPinReason,
  account: StoredAccount | undefined,
  ctx: Context
): Promise<void> {
  if (reason === "authorize_transfer") {
    if (!account?.privateKeyHex) {
      clearAwaitingPin(PLATFORM, userId);
      clearPendingTransfer(PLATFORM, userId);
      await ctx.reply("This account cannot sign. Transfer cancelled.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    }
    if (!(await verifyPin(PLATFORM, userId, pin))) {
      const attempts = incrementPinAttempts(PLATFORM, userId);
      if (attempts >= MAX_PIN_ATTEMPTS) {
        clearAwaitingPin(PLATFORM, userId);
        clearPendingTransfer(PLATFORM, userId);
        await ctx.reply("Wrong PIN too many times. Transfer cancelled.", {
          parse_mode: "Markdown",
          reply_markup: REMOVE_KEYBOARD,
        });
      } else {
        await ctx.reply(`Wrong PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt(s) left.`, {
          parse_mode: "Markdown",
          reply_markup: REMOVE_KEYBOARD,
        });
      }
      return;
    }
    clearAwaitingPin(PLATFORM, userId);
    const pending = getPendingTransfer(PLATFORM, userId);
    if (!pending) {
      await ctx.reply("Transfer no longer pending.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    }
    const book = await getAddressBook(PLATFORM, userId);
    const addressesInBook = book.map((e) => e.address);
    const limitsCheck = await checkSpendingLimits(
      PLATFORM,
      userId,
      pendingToCheckInput(pending),
      addressesInBook
    );
    if (!limitsCheck.allowed) {
      await ctx.reply(limitsCheck.reason, {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
      clearPendingTransfer(PLATFORM, userId);
      return;
    }
    await ctx.api.sendChatAction(ctx.chat!.id, "typing");
    try {
      const result = await executeTransfer(account.privateKeyHex, pending);
      clearPendingTransfer(PLATFORM, userId);
      if (result.error || !result.success) {
        await ctx.reply(`Transfer failed: ${stripAnsi(result.error ?? "Unknown error")}`, {
          parse_mode: "Markdown",
          reply_markup: REMOVE_KEYBOARD,
        });
        return;
      }
      await addDailySpentTon(PLATFORM, userId, Number(pending.amountTon));
      await addTransaction(PLATFORM, userId, buildHistoryEntry(pending, result.txHash!));
      await sendProcessingThenConfirmed(pending, result.txHash!, ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Transfer failed: ${stripAnsi(msg)}`, {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
      clearPendingTransfer(PLATFORM, userId);
    }
    return;
  }

  if (reason === "set_pin") {
    const result = await setPin(PLATFORM, userId, pin);
    clearAwaitingPin(PLATFORM, userId);
    if (result.ok) {
      await ctx.reply("**PIN set.** You'll be asked for it when you confirm a transfer.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
    } else {
      await ctx.reply(result.error ?? "Could not set PIN.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
    }
    return;
  }

  if (reason === "change_pin_current") {
    if (!(await verifyPin(PLATFORM, userId, pin))) {
      const attempts = incrementPinAttempts(PLATFORM, userId);
      if (attempts >= MAX_PIN_ATTEMPTS) {
        clearAwaitingPin(PLATFORM, userId);
        await ctx.reply("Wrong PIN too many times. Use /changepin to try again.", {
          parse_mode: "Markdown",
          reply_markup: REMOVE_KEYBOARD,
        });
      } else {
        await ctx.reply(
          `Wrong PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt(s) left. Reply with your current 6-digit PIN.`,
          { parse_mode: "Markdown", reply_markup: REMOVE_KEYBOARD }
        );
      }
      return;
    }
    setAwaitingPin(PLATFORM, userId, "change_pin_new");
    await ctx.reply("Enter your **new** 6-digit PIN.", { parse_mode: "Markdown" });
    return;
  }

  if (reason === "change_pin_new") {
    const result = await setPin(PLATFORM, userId, pin);
    clearAwaitingPin(PLATFORM, userId);
    if (result.ok) {
      await ctx.reply("**PIN changed.** Use your new PIN when confirming transfers.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
    } else {
      await ctx.reply(result.error ?? "Could not change PIN.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
    }
  }
}

async function handleAwaitingPin(
  userId: string,
  text: string,
  account: StoredAccount | undefined,
  ctx: Context
): Promise<boolean> {
  const state = getAwaitingPin(PLATFORM, userId);
  if (!state) return false;

  const lower = text.trim().toLowerCase();
  if (lower === "cancel" || lower === "c") {
    clearAwaitingPin(PLATFORM, userId);
    if (state.reason === "authorize_transfer") {
      clearPendingTransfer(PLATFORM, userId);
      await ctx.reply("Transfer cancelled.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
    } else {
      await ctx.reply("Cancelled.", {
        parse_mode: "Markdown",
        reply_markup: REMOVE_KEYBOARD,
      });
    }
    return true;
  }

  if (!looksLikePin(text)) {
    await ctx.reply("Please enter your 6-digit PIN. Or say **Cancel** to cancel.", {
      parse_mode: "Markdown",
    });
    return true;
  }

  await processPinSubmission(userId, text, state.reason, account, ctx);
  return true;
}

export function run(bot: Bot): void {
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply(DM_ONLY_MSG, { parse_mode: "Markdown" });
      return;
    }
    return next();
  });

  // /start
  bot.command("start", async (ctx) => {
    const userId = getUserId(ctx);
    let account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.api.sendChatAction(ctx.chat!.id, "typing");
      try {
        const newAccount = await createAccount();
        await setAccount(PLATFORM, userId, newAccount);
        setState(userId, { defaultAddress: newAccount.address });
        account = { address: newAccount.address, privateKeyHex: newAccount.privateKeyHex };
      } catch (e) {
        await ctx.reply(
          "Could not create wallet: " + (e instanceof Error ? e.message : String(e)),
          { parse_mode: "Markdown" }
        );
        return;
      }
    }
    const network = process.env.TON_NETWORK ?? "mainnet";
    const networkLabel = network === "mainnet" ? "Mainnet" : "Testnet";
    await ctx.reply(
      `\uD83D\uDCB0 **Your TON wallet (${networkLabel})**\n\n` +
        "• **Address:**\n`" +
        account.address +
        "`\n\n" +
        "Use **/menu** for Balance, Send, History, Settings.",
      { parse_mode: "Markdown" }
    );
  });

  // /menu
  bot.command("menu", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    const menuKb = new InlineKeyboard()
      .text("Balance", "menu_balance")
      .text("Address", "menu_address")
      .row()
      .text("Send", "menu_send")
      .text("History", "menu_history")
      .row()
      .text("Settings", "menu_settings");
    await ctx.reply("**Menu**", { parse_mode: "Markdown", reply_markup: menuKb });
  });

  // Callbacks
  bot.callbackQuery("menu_balance", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.answerCallbackQuery();
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    await ctx.answerCallbackQuery();
    const balanceNano = await getTonBalance(account.address);
    const balanceStr = formatTonFromNano(balanceNano);
    await setLastBalance(PLATFORM, userId, { balanceNano: balanceNano.toString() });
    await ctx.reply(`\uD83D\uDCB0 **Balance:** ${balanceStr} TON`, { parse_mode: "Markdown" });
  });

  bot.callbackQuery("menu_address", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.answerCallbackQuery();
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply("**Address:**\n`" + account.address + "`", { parse_mode: "Markdown" });
  });

  bot.callbackQuery("menu_send", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Reply with the amount and address, e.g.:\n_1.5 TON to UQB..._\nOr: _Send 1 TON to Exchange_ (if you have a saved contact).",
      { parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery("menu_history", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.answerCallbackQuery();
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    await ctx.answerCallbackQuery();
    const history = await getTransactionHistory(PLATFORM, userId);
    const lines = history.slice(0, 15).map((e) => {
      const link = explorerBase() + "/tx/" + e.txHash;
      return `• ${e.amount} TON → \`${e.recipientAddress.slice(0, 8)}...\` [View](${link})`;
    });
    const text =
      lines.length === 0
        ? "No transactions yet."
        : "**Recent transactions:**\n\n" + lines.join("\n");
    await ctx.reply(text, { parse_mode: "Markdown" });
  });

  bot.callbackQuery("menu_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    const settingsKb = new InlineKeyboard()
      .text("PIN", "settings_pin")
      .text("Limits", "settings_limits")
      .row()
      .text("Address book", "settings_addressbook");
    await ctx.reply("**Settings**", { parse_mode: "Markdown", reply_markup: settingsKb });
  });

  bot.callbackQuery("settings_pin", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = getUserId(ctx);
    const pinSet = await hasPin(PLATFORM, userId);
    if (pinSet) {
      await ctx.reply("You have a PIN set. Use **/changepin** to change it.", {
        parse_mode: "Markdown",
      });
    } else {
      await ctx.reply("Use **/setpin** to set a 6-digit PIN for confirming transfers.", {
        parse_mode: "Markdown",
      });
    }
  });

  bot.callbackQuery("settings_limits", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use **/limits** to view or set spending limits.", { parse_mode: "Markdown" });
  });

  bot.callbackQuery("settings_addressbook", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use **/addressbook** to list or manage saved addresses.", {
      parse_mode: "Markdown",
    });
  });

  // Send again
  bot.callbackQuery("again_same", async (ctx) => {
    const userId = getUserId(ctx);
    const last = await getLastTransfer(PLATFORM, userId);
    if (!last) {
      await ctx.answerCallbackQuery();
      await ctx.reply("No previous transfer. Start a new one (e.g. _1 TON to UQB..._).", {
        parse_mode: "Markdown",
      });
      return;
    }
    setPendingTransfer(PLATFORM, userId, last);
    const pinSet = await hasPin(PLATFORM, userId);
    if (pinSet) {
      setAwaitingPin(PLATFORM, userId, "authorize_transfer");
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `Send ${last.amountTon} TON to \`${last.recipientAddress}\`. Reply with your **6-digit PIN** to confirm, or **Cancel** to cancel.`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `Send ${last.amountTon} TON to \`${last.recipientAddress}\`. Reply **Yes** to confirm, **Cancel** to cancel.`,
        { parse_mode: "Markdown" }
      );
    }
  });

  bot.callbackQuery("again_recip", async (ctx) => {
    const userId = getUserId(ctx);
    const last = await getLastTransfer(PLATFORM, userId);
    if (!last) {
      await ctx.answerCallbackQuery();
      await ctx.reply("No previous transfer.");
      return;
    }
    await setAwaitingSendAgain(PLATFORM, userId, { recipientAddress: last.recipientAddress });
    await ctx.answerCallbackQuery();
    await ctx.reply("Reply with the **amount in TON** (e.g. _2_ or _0.5_) to send to the same recipient.", {
      parse_mode: "Markdown",
    });
  });

  bot.callbackQuery("again_new", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Reply with amount and address, e.g. _1 TON to UQB..._", {
      parse_mode: "Markdown",
    });
  });

  // Commands
  bot.command("address", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    await ctx.reply("**Address:**\n`" + account.address + "`", { parse_mode: "Markdown" });
  });

  bot.command("balance", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    const balanceNano = await getTonBalance(account.address);
    const balanceStr = formatTonFromNano(balanceNano);
    await ctx.reply(`\uD83D\uDCB0 **Balance:** ${balanceStr} TON`, { parse_mode: "Markdown" });
  });

  bot.command("history", async (ctx) => {
    const userId = getUserId(ctx);
    const account = await getAccount(PLATFORM, userId);
    if (!account) {
      await ctx.reply(SETUP_REQUIRED_MSG, { parse_mode: "Markdown" });
      return;
    }
    const history = await getTransactionHistory(PLATFORM, userId);
    const lines = history.slice(0, 15).map((e) => {
      const link = explorerBase() + "/tx/" + e.txHash;
      return `• ${e.amount} TON → [View](${link})`;
    });
    const text =
      lines.length === 0
        ? "No transactions yet."
        : "**Recent transactions:**\n\n" + lines.join("\n");
    await ctx.reply(text, { parse_mode: "Markdown" });
  });

  bot.command("addressbook", async (ctx) => {
    const userId = getUserId(ctx);
    const book = await getAddressBook(PLATFORM, userId);
    if (book.length === 0) {
      await ctx.reply("Address book is empty. Add entries like: _Add Exchange as UQB..._", {
        parse_mode: "Markdown",
      });
      return;
    }
    const lines = book.map((e) => `• **${e.label}:** \`${e.address}\``);
    await ctx.reply("**Address book:**\n\n" + lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.command("limits", async (ctx) => {
    const userId = getUserId(ctx);
    const limits = await getSpendingLimits(PLATFORM, userId);
    const spent = await getDailySpentTon(PLATFORM, userId);
    let msg =
      "**Spending limits**\n\n" +
      `• Daily spent today: ${spent.toFixed(2)} TON\n` +
      (limits.perTransferMaxTon != null
        ? `• Per-transfer max: ${limits.perTransferMaxTon} TON\n`
        : "") +
      (limits.dailyMaxTon != null ? `• Daily max: ${limits.dailyMaxTon} TON\n` : "") +
      (limits.whitelistOnly ? "• Whitelist-only: **on** (only address book)\n" : "") +
      (limits.largeSendThresholdTon != null
        ? `• Large-send confirmation: above ${limits.largeSendThresholdTon} TON\n`
        : "");
    msg += "\nTo change limits, reply with e.g. _per transfer 10_ or _daily 50_.";
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  bot.command("reminders", async (ctx) => {
    const userId = getUserId(ctx);
    const reminders = await getReminders(PLATFORM, userId);
    if (reminders.length === 0) {
      await ctx.reply("No reminders. Say e.g. _Remind me to send 10 TON every week_.", {
        parse_mode: "Markdown",
      });
      return;
    }
    const lines = reminders.map(
      (r, i) =>
        `${i + 1}. ${r.amountTon ?? "?"} TON${r.recipientLabel ? " to " + r.recipientLabel : ""} — ${r.interval} (next: ${new Date(r.nextRunAt).toISOString().slice(0, 10)})`
    );
    await ctx.reply("**Reminders:**\n\n" + lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.command("setpin", async (ctx) => {
    const userId = getUserId(ctx);
    if (await hasPin(PLATFORM, userId)) {
      await ctx.reply("You already have a PIN. Use **/changepin** to change it.", {
        parse_mode: "Markdown",
      });
      return;
    }
    setAwaitingPin(PLATFORM, userId, "set_pin");
    await ctx.reply("Reply with your **6-digit PIN** to set (digits only).", {
      parse_mode: "Markdown",
    });
  });

  bot.command("changepin", async (ctx) => {
    const userId = getUserId(ctx);
    if (!(await hasPin(PLATFORM, userId))) {
      await ctx.reply("You don't have a PIN. Use **/setpin** first.", { parse_mode: "Markdown" });
      return;
    }
    setAwaitingPin(PLATFORM, userId, "change_pin_current");
    await ctx.reply("Reply with your **current** 6-digit PIN.", { parse_mode: "Markdown" });
  });

  // Text handler: pending transfer confirm, awaiting PIN, awaiting amount, or agent
  bot.on("message:text", async (ctx) => {
    const userId = getUserId(ctx);
    const text = ctx.message.text?.trim() ?? "";
    const account = await getAccount(PLATFORM, userId);

    if (await handleAwaitingPin(userId, text, account ?? undefined, ctx)) return;

    const pending = getPendingTransfer(PLATFORM, userId);
    if (pending) {
      if (isConfirmation(text)) {
        const pinSet = await hasPin(PLATFORM, userId);
        if (pinSet) {
          setAwaitingPin(PLATFORM, userId, "authorize_transfer");
          await ctx.reply(
            "Reply with your **6-digit PIN** to confirm the transfer, or **Cancel** to cancel.",
            { parse_mode: "Markdown" }
          );
        } else {
          const book = await getAddressBook(PLATFORM, userId);
          const limitsCheck = await checkSpendingLimits(
            PLATFORM,
            userId,
            pendingToCheckInput(pending),
            book.map((e) => e.address)
          );
          if (!limitsCheck.allowed) {
            await ctx.reply(limitsCheck.reason, { parse_mode: "Markdown" });
            return;
          }
          if (account?.privateKeyHex) {
            const result = await executeTransfer(account.privateKeyHex, pending);
            clearPendingTransfer(PLATFORM, userId);
            if (result.success && result.txHash) {
              await addDailySpentTon(PLATFORM, userId, Number(pending.amountTon));
              await addTransaction(PLATFORM, userId, buildHistoryEntry(pending, result.txHash));
              await sendProcessingThenConfirmed(pending, result.txHash, ctx);
            } else {
              await ctx.reply("Transfer failed: " + (result.error ?? "Unknown"), {
                parse_mode: "Markdown",
              });
            }
          } else {
            await ctx.reply("This account cannot sign. Transfer cancelled.", {
              parse_mode: "Markdown",
            });
            clearPendingTransfer(PLATFORM, userId);
          }
        }
        return;
      }
      if (text.toLowerCase() === "cancel" || text.toLowerCase() === "c") {
        clearPendingTransfer(PLATFORM, userId);
        await ctx.reply("Transfer cancelled.", { parse_mode: "Markdown" });
        return;
      }
    }

    const awaitingAmount = await getAwaitingSendAgain(PLATFORM, userId);
    if (awaitingAmount) {
      const num = parseFloat(text.replace(/,/g, "."));
      if (!Number.isFinite(num) || num <= 0) {
        await ctx.reply("Reply with a valid amount in TON (e.g. _1_ or _0.5_).", {
          parse_mode: "Markdown",
        });
        return;
      }
      const amountNano = BigInt(Math.round(num * 1e9));
      const amountTon = num.toFixed(2);
      setPendingTransfer(PLATFORM, userId, {
        asset: "TON",
        amountNano: amountNano.toString(),
        amountTon,
        recipientAddress: awaitingAmount.recipientAddress,
      });
      await clearAwaitingSendAgain(PLATFORM, userId);
      const pinSet = await hasPin(PLATFORM, userId);
      if (pinSet) {
        setAwaitingPin(PLATFORM, userId, "authorize_transfer");
        await ctx.reply(
          `Send ${amountTon} TON to \`${awaitingAmount.recipientAddress}\`. Reply with your **6-digit PIN** to confirm.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          `Send ${amountTon} TON to \`${awaitingAmount.recipientAddress}\`. Reply **Yes** to confirm.`,
          { parse_mode: "Markdown" }
        );
      }
      return;
    }

    // Simple send parsing: "1.5 TON to UQB..." or "Send 1 TON to Exchange"
    const sendMatch = text.match(
      /^(?:send\s+)?(\d+(?:\.\d+)?)\s*ton\s+to\s+(.+)$/i
    );
    if (sendMatch && account) {
      const amountTon = parseFloat(sendMatch[1]);
      let recipient = sendMatch[2].trim();
      const byLabel = await getAddressByLabel(PLATFORM, userId, recipient);
      if (byLabel) recipient = byLabel;
      if (!recipient.startsWith("UQ") && !recipient.startsWith("EQ")) {
        await ctx.reply("I couldn’t resolve that address or label. Use a TON address (UQ.../EQ...) or a saved label.", {
          parse_mode: "Markdown",
        });
        return;
      }
      const amountNano = BigInt(Math.round(amountTon * 1e9));
      const book = await getAddressBook(PLATFORM, userId);
      const limitsCheck = await checkSpendingLimits(
        PLATFORM,
        userId,
        { amountTon, recipientAddress: recipient, asset: "TON" },
        book.map((e) => e.address)
      );
      if (!limitsCheck.allowed) {
        await ctx.reply(limitsCheck.reason, { parse_mode: "Markdown" });
        return;
      }
      const aboveLarge = await isAboveLargeSendThreshold(PLATFORM, userId, {
        asset: "TON",
        amountNano: amountNano.toString(),
        amountTon: String(amountTon),
        recipientAddress: recipient,
        createdAt: Date.now(),
      });
      if (aboveLarge) {
        const awaiting = await getAwaitingLargeConfirm(PLATFORM, userId);
        if (!awaiting) {
          await setAwaitingLargeConfirm(PLATFORM, userId);
          await ctx.reply(
            "This is a **large send**. Reply **CONFIRM LARGE** to continue, or **Cancel** to cancel.",
            { parse_mode: "Markdown" }
          );
          return;
        }
        await clearAwaitingLargeConfirm(PLATFORM, userId);
      }
      setPendingTransfer(PLATFORM, userId, {
        asset: "TON",
        amountNano: amountNano.toString(),
        amountTon: String(amountTon),
        recipientAddress: recipient,
      });
      const pinSet = await hasPin(PLATFORM, userId);
      if (pinSet) {
        setAwaitingPin(PLATFORM, userId, "authorize_transfer");
        await ctx.reply(
          `Send ${amountTon} TON to \`${recipient}\`. Reply with your **6-digit PIN** to confirm, or **Cancel** to cancel.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          `Send ${amountTon} TON to \`${recipient}\`. Reply **Yes** to confirm, **Cancel** to cancel.`,
          { parse_mode: "Markdown" }
        );
      }
      return;
    }

    // Add address: "Add Exchange as UQB..."
    const addMatch = text.match(/^add\s+(.+?)\s+as\s+(.+)$/i);
    if (addMatch && account) {
      const label = addMatch[1].trim();
      const address = addMatch[2].trim();
      const result = await addAddress(PLATFORM, userId, label, address);
      if ("ok" in result && result.ok) {
        await ctx.reply(`Added **${label}** as \`${address}\`.`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply("error" in result ? result.error : "Could not add.", {
          parse_mode: "Markdown",
        });
      }
      return;
    }

    // CONFIRM LARGE
    if (isConfirmLarge(text)) {
      const awaiting = await getAwaitingLargeConfirm(PLATFORM, userId);
      if (awaiting) {
        await clearAwaitingLargeConfirm(PLATFORM, userId);
        await ctx.reply("Reply with the send command again to continue (e.g. _1 TON to UQB..._).", {
          parse_mode: "Markdown",
        });
      }
      return;
    }

    // Fallback: AI agent
    const agentContext: AgentContext = {
      defaultAddress: account?.address ?? getState(userId).defaultAddress,
      notifyUserId: userId,
      notifyPlatform: PLATFORM,
    };
    await ctx.api.sendChatAction(ctx.chat!.id, "typing");
    const reply = await runAgent(text, agentContext);
    await ctx.reply(stripAnsi(reply), { parse_mode: "Markdown" });
  });
}
