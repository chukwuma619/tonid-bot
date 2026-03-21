# tonid-bot

Telegram bot for **TON** (The Open Network) with wallet, transfers, and an AI agent — built for the [Identity Hub TON AI Hackathon](https://identityhub.app/contests/ai-hackathon).

Monorepo: **official website** (Next.js) and **Telegram bot** (GrammY + [Telegram Bot API](https://core.telegram.org/bots/api)). Shared TON client, account, PIN, transfer, and AI agent logic live in `packages/shared`.

## What the bot does

- **Wallet & identity** — Create a TON wallet from Telegram, get your address, view balance (TON and optionally jetton tokens).
- **Send TON** — Send TON to any address or to saved contacts. Optional PIN and spending limits for safety.
- **History & explorer** — Recent transaction history with links to TON explorer (e.g. tonscan.org).
- **Address book** — Save addresses under labels (e.g. “Exchange”, “Friend”) and send by name.
- **Safety** — Optional PIN to authorize transfers; per-transfer and daily spending limits; whitelist-only mode; extra confirmation for large sends.
- **Reminders** — Schedule reminders (e.g. “remind me to send 10 TON every week”); you get a notification and confirm each send yourself.
- **Natural language** — In DMs you can ask “What’s my balance?”, “Send 1 TON to UQB…”, “Add Exchange as UQB…” and the AI agent interprets and runs the right action.

The bot works in **direct messages** only. Use **/menu** for a persistent inline menu (Balance | Address | Send | History | Settings).

## Structure

| Path | Description |
|------|-------------|
| `website` | Next.js app (marketing/official site). No bot webhook here. |
| `telegram-bot` | Standalone Node bot using [GrammY](https://grammy.dev); webhook or long polling, sends messages via the official Bot API. |
| `packages/shared` | TON client, account store, PIN store, pending transfers, execute-transfer, create-account, AI agent. Used by the bot (and optionally by the website). |

## Hackathon context

- **Event:** [Identity Hub TON AI Hackathon](https://identityhub.app/contests/ai-hackathon) — AI agents on TON (Telegram + AI + TON).
- **Tracks:** Agent Infrastructure (wallet integrations, payment flows) and User-Facing Agents (Telegram bots, AI assistants).
- This project targets both: a **user-facing** Telegram wallet/assistant with **agent infrastructure** (wallet, transfers, limits, PIN, address book).

## Prerequisites

- **Node.js** 18+
- **pnpm**
- **Redis** (for account/PIN and state)
- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
- **AI Gateway API key** (e.g. Anthropic) for the natural-language agent

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd tonid-bot
   pnpm install
   ```

2. **Environment**

   Copy `env.example` to `.env` at the repo root (or into each app that needs it). The Telegram bot reads the same env vars for TON, Redis, and AI; set `TELEGRAM_BOT_TOKEN` and optionally `TELEGRAM_WEBHOOK_URL` for webhook mode.

   **TON setup:** The bot uses [Wallet V4R2](https://docs.ton.org/standard/wallets/v4) and [TonCenter API v2](https://docs.ton.org/ecosystem/api/toncenter). Set `TON_RPC_URL` to the API base (e.g. `https://toncenter.com/api/v2` for mainnet or `https://testnet.toncenter.com/api/v2` for testnet) and `TON_NETWORK` to `mainnet` or `testnet`. Optionally set `TON_API_KEY` to reduce rate limits. See [TON documentation](https://docs.ton.org) for more.

3. **Run**

   - **Website (Next.js)**  
     ```bash
     pnpm dev:website
     ```
     Or from `website`: `pnpm dev`.

   - **Telegram bot**  
     ```bash
     pnpm dev:bot
     ```
     Or from `telegram-bot`: `pnpm dev`.  
     Without `TELEGRAM_WEBHOOK_URL`, the bot uses long polling. With it, run the bot behind HTTPS and set the webhook URL (e.g. `https://your-domain.com/webhook`).

## Bot commands

| Command | Description |
|---------|-------------|
| `/start` | Create wallet (if none) and show address |
| `/menu` | Quick menu: Balance, Address, Send, History, Settings (PIN, limits, address book) |
| `/address` | Show your TON address |
| `/balance` | Show TON (and optionally jetton) balance |
| `/history` | Recent transaction history with [View on explorer] per tx |
| `/addressbook` | List saved addresses (label → TON address) |
| `/limits` | View spending limits and how much you’ve spent today |
| `/reminders` | List scheduled reminders |
| `/setpin` | Set a PIN for authorizing transfers |
| `/changepin` | Change existing PIN |

In DMs you can also use natural language (e.g. “What’s my balance?”, “Send 1 TON to UQB…”).

**Settings:** PIN, limits, and address book. **After a transfer:** optional “Send again?” with [Same amount] [Same recipient] [New transfer].

## Scripts (root)

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all workspace packages |
| `pnpm dev:website` | Start Next.js dev server |
| `pnpm dev:bot` | Start Telegram bot (polling or webhook server) |
| `pnpm lint` | Lint all packages |

## References

- [Identity Hub — TON AI Hackathon](https://identityhub.app/contests/ai-hackathon)
- [GrammY](https://grammy.dev) – bot framework
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [TON Documentation](https://docs.ton.org) — Wallet V4, [TonCenter API](https://docs.ton.org/ecosystem/api/toncenter), [SDKs](https://docs.ton.org/develop/dapps/apis/sdk)
