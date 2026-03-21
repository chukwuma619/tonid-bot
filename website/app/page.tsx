function telegramBotHref(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) return null;
  const user = raw.replace(/^@/, "");
  if (!user) return null;
  return `https://t.me/${user}`;
}

const features = [
  {
    title: "Wallet & identity",
    body: "Spin up a TON wallet from Telegram, copy your address, and check TON plus jetton balances.",
  },
  {
    title: "Send & explore",
    body: "Send to any address or saved contact. History links out to the explorer so you can verify every tx.",
  },
  {
    title: "Address book",
    body: "Label addresses—exchange, friend, cold storage—and send by name instead of pasting long strings.",
  },
  {
    title: "Safety controls",
    body: "Optional PIN, per-transfer and daily limits, whitelist mode, and extra checks on large sends.",
  },
  {
    title: "AI assistant",
    body: 'In DMs, ask in plain language: “What’s my balance?”, “Send 1 TON to…”, “Add Exchange as UQB…”.',
  },
  {
    title: "Reminders",
    body: "Schedule nudges for recurring sends; you confirm each payment yourself when the bot pings you.",
  },
] as const;

export default function Home() {
  const telegramHref = telegramBotHref();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,var(--ring)_0%,transparent_55%)] opacity-[0.18] dark:opacity-[0.22]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,var(--background)_38%,var(--background)_100%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-8">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          TonID
        </span>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm font-medium">
          {telegramHref ? (
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#0088cc] px-4 py-2 text-white shadow-sm ring-1 ring-white/20 transition hover:brightness-110"
            >
              Open in Telegram
            </a>
          ) : null}
          <a
            href="https://identityhub.app/contests/ai-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-foreground/12 px-4 py-2 text-foreground transition hover:bg-foreground/6"
          >
            Hackathon
          </a>
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24">
        <section className="mx-auto max-w-3xl pt-4 text-center sm:pt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            TON · Telegram · AI
          </p>
          <h1 className="font-display mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl sm:leading-[1.05]">
            Your TON wallet, one chat away
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            TonID Bot is a direct-message assistant for The Open Network: balances, transfers, an
            address book, safety limits, and natural-language commands—without leaving Telegram.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {telegramHref ? (
              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full min-h-12 items-center justify-center rounded-full bg-[#0088cc] px-8 py-3.5 text-base font-semibold text-white shadow-md ring-1 ring-white/20 transition hover:brightness-110 sm:w-auto"
              >
                Start on Telegram
              </a>
            ) : (
              <p className="max-w-md rounded-2xl border border-dashed border-foreground/18 bg-surface px-5 py-4 text-sm text-muted">
                Set{" "}
                <code className="rounded bg-foreground/8 px-1.5 py-0.5 text-foreground">
                  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
                </code>{" "}
                in your env to show a live “Open in Telegram” button.
              </p>
            )}
            <a
              href="https://github.com/chukwuma619/tonid-bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-full border border-foreground/14 px-8 py-3.5 text-base font-semibold text-foreground transition hover:bg-foreground/6 sm:w-auto"
            >
              View source
            </a>
          </div>
          <p className="mt-4 text-xs text-muted">
            DMs only · Use <code className="rounded bg-foreground/8 px-1 text-foreground">/menu</code> for Balance, Address, Send, History, and Settings
          </p>
        </section>

        <section className="mt-20 sm:mt-28">
          <h2 className="font-display text-center text-2xl font-bold text-foreground sm:text-3xl">
            What you get
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
            Everything in one thread: wallet operations, guardrails, and an agent that understands
            how you talk.
          </p>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-foreground/10 bg-surface p-6 shadow-sm"
              >
                <h3 className="font-display text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 rounded-3xl border border-foreground/10 bg-surface p-8 shadow-sm sm:mt-20 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                Built for the Identity Hub TON AI Hackathon
              </h2>
              <p className="mt-3 text-muted">
                TonID pairs a user-facing Telegram wallet with agent-style flows—wallet
                integrations, payment paths, PIN, limits, and interpreted commands—so TON feels as
                easy as messaging a friend.
              </p>
            </div>
            <a
              href="https://identityhub.app/contests/ai-hackathon"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Contest details →
            </a>
          </div>
        </section>

      </main>

      <footer className="relative z-10 border-t border-foreground/10 py-8 text-center text-xs text-muted">
        TonID Bot · TON on Telegram
      </footer>
    </div>
  );
}
