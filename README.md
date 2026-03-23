# TonID (tonid-bot)

**TonID** is a **user-facing AI assistant** for **TON (The Open Network)** inside **Telegram**: users get a TON wallet, send and receive TON, manage an address book and safety settings, and can drive most flows either through **natural language** (an AI layer with tool calling) or through **menus and slash commands**. Transfers are **confirmation-gated** (and optional PIN / limits)—the assistant helps set things up; it does not silently move funds.

This repository is a **pnpm monorepo**:

| Part | Role |
|------|------|
| **`telegram-bot`** | Production GrammY bot: DMs, webhooks or long polling, wallet + Redis-backed state. |
| **`packages/shared`** | TON client (TonCenter), account/PIN/transfers, spending limits, address book, **AI agent** (Vercel AI SDK + tools). |
| **`website`** | Next.js marketing / landing site (optional public Telegram link via env). |

Built for the **[Identity Hub TON AI Hackathon](https://identityhub.app/contests/ai-hackathon)** (AI + TON + Telegram).

---

## What it does

- **Wallet** — Create a TON wallet from Telegram ([Wallet V4R2](https://docs.ton.org/standard/wallets/v4)), show address, balance (TON; jettons where supported).
- **Transfers** — Send to raw addresses or **saved labels**; optional **PIN**, per-transfer / daily **limits**, whitelist mode, extra step for large sends.
- **History** — Recent sends with links to a TON explorer (configured via `TON_EXPLORER_URL`).
- **Address book** — Label → address; send by name.
- **Reminders** — Scheduled **notifications** (no auto-send; user confirms each payment).
- **Natural language** — In DMs, configured AI (`AI_GATEWAY_API_KEY`) interprets messages and invokes **defined tools** (balance, prepare transfer, limits, etc.). If AI is not configured, the bot tells the user; **/menu** and commands still work.
- **Website** — Static-friendly Next app for project info and “Open in Telegram” when `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set.

**Groups:** wallet actions run in **private chats only** (not in groups).

---

## Repository layout

```
tonid-bot/
├── telegram-bot/     # GrammY bot entry (Node, Express webhook or polling)
├── website/          # Next.js app
├── packages/shared/  # Shared library (TON, stores, agent)
├── pnpm-workspace.yaml
└── env.example       # Copy to .env for local or reference for deploy
```

---

## Prerequisites

- **Node.js** 18+
- **pnpm** (`corepack enable` or install globally)
- **Redis** — required for accounts, PIN, pending transfers, and related state
- **Telegram bot token** — from [@BotFather](https://t.me/BotFather)
- **AI provider key** — for natural-language mode: set **`AI_GATEWAY_API_KEY`** (see `packages/shared` / Vercel AI SDK usage)

---

## Local development

### 1. Clone and install

```bash
git clone <your-fork-or-repo-url>
cd tonid-bot
pnpm install
```

### 2. Environment

Copy `env.example` to **`.env`** at the **repository root** (the bot and shared code expect the same variables in typical setups):

```bash
cp env.example .env
```

Edit `.env` and set at least:

- **`TELEGRAM_BOT_TOKEN`** — from BotFather  
- **`REDIS_URL`** — e.g. `redis://localhost:6379` or a cloud URL  
- **`TON_RPC_URL`**, **`TON_NETWORK`**, **`TON_EXPLORER_URL`** — match mainnet or testnet  
- **`AI_GATEWAY_API_KEY`** — if you want natural-language replies in DMs  

Optional: **`TELEGRAM_WEBHOOK_URL`** (HTTPS) for webhook mode; if unset, the bot uses **long polling**.

For the **website** only, you can add **`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`** in `website/.env` (username without `@`) so the landing page shows “Open in Telegram.”

### 3. Run

| Goal | Command |
|------|---------|
| Next.js (dev) | `pnpm dev:website` or `cd website && pnpm dev` |
| Telegram bot (dev) | `pnpm dev:bot` or `cd telegram-bot && pnpm dev` |
| Build everything | `pnpm build` |

---

## Deployment

Deploy **two** pieces in production unless you only need one: the **Telegram bot** (always-on Node + Redis) and optionally the **website** (Next.js). Both share **`packages/shared`**, so builds should run from the **monorepo root** with `pnpm install` and `pnpm build` unless you use per-package roots and a custom pipeline.

### Environment variables (production)

Use the same logical variables as `env.example`. Minimum for the **bot**:

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `REDIS_URL` | Production Redis |
| `TON_RPC_URL` | TonCenter JSON-RPC URL |
| `TON_NETWORK` | `mainnet` or `testnet` |
| `TON_EXPLORER_URL` | Explorer base URL for links |
| `AI_GATEWAY_API_KEY` | Natural-language agent (omit only if you accept degraded DM UX) |
| `TELEGRAM_WEBHOOK_URL` | Optional; HTTPS URL your bot listens on for webhooks |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Optional; Telegram webhook secret |
| `ENCRYPTION_KEY` | Recommended in production (64 hex chars) for key encryption at rest |

For the **website**:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username (no `@`) for landing CTA buttons |

### Railway (Railpack)

This repo defines root scripts so Railpack can detect a **`start`** command when the **root** is the service directory:

| Service | Root directory | Build command (typical) | Start command |
|---------|----------------|-------------------------|---------------|
| **Website** | `.` (repo root) | `pnpm install && pnpm build` | `pnpm start` (defaults to Next.js `next start`) |
| **Telegram bot** | `.` (repo root) | same | `pnpm run start:bot` |

Use **two Railway services** from the same GitHub repo: one for the site, one for the bot, with different start commands and the env vars above.

**Watch paths** (optional, to limit redeploys):

- Website: `website/**`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`
- Bot: `telegram-bot/**`, `packages/shared/**`, same lockfile/workspace files

If you set **Root Directory** to `website` or `telegram-bot` only, use that package’s `build` / `start` and ensure **`packages/shared`** is built first (e.g. custom build: `pnpm install && pnpm --filter @tonid-bot/shared build && pnpm --filter @tonid-bot/website build`).

### Other hosts (Vercel, Fly, Docker, etc.)

- **Website:** Many teams deploy **`website`** as a Next.js app: set project **root** to `website`, install, `pnpm build`, `pnpm start`, and add `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` in the dashboard.  
- **Bot:** Needs long-running Node + **Redis**; use any VPS, Fly.io, Railway, Render, etc., with `pnpm build` then `pnpm run start:bot` from repo root (or equivalent filtered build).

---

## Root scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all workspace packages (`shared`, `telegram-bot`, `website`) |
| `pnpm dev:website` | Next.js dev server |
| `pnpm dev:bot` | Bot in dev (tsx) |
| `pnpm start` | **Production:** start Next.js site (`@tonid-bot/website`) |
| `pnpm run start:website` | Same as default `start` |
| `pnpm run start:bot` | **Production:** run compiled bot (`node dist/index.js` after build) |
| `pnpm lint` | Lint workspace |

---

## Bot commands (reference)

| Command | Description |
|---------|-------------|
| `/start` | Create wallet (if none) and show address |
| `/menu` | Balance, Address, Send, History, Settings |
| `/address` | Show TON address |
| `/balance` | Balance |
| `/history` | Recent sends + explorer links |
| `/addressbook` | Saved labels |
| `/limits` | Spending limits |
| `/reminders` | List reminders |
| `/setpin` / `/changepin` | PIN |

Natural language works in DMs when AI is configured.

---

## References

- [Identity Hub — TON AI Hackathon](https://identityhub.app/contests/ai-hackathon)
- [GrammY](https://grammy.dev)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [TON Docs](https://docs.ton.org) — Wallet V4, [TonCenter API](https://docs.ton.org/ecosystem/api/toncenter)
