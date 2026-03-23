function telegramBotHref(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) return null;
  const user = raw.replace(/^@/, "");
  if (!user) return null;
  return `https://t.me/${user}`;
}

const features = [
  {
    title: "Ask in plain language",
    body: "Message the bot the way you’d text a friend—check your balance, send TON, add a saved address, or tweak limits. The assistant figures out what you mean and walks you through the steps.",
  },
  {
    title: "You confirm every send",
    body: "Nothing goes on-chain until you say so. You’ll see the details first, then confirm (and use your PIN if you turned it on). Spending limits and safety checks still apply.",
  },
  {
    title: "Wallet, balance & activity",
    body: "Create a TON wallet from Telegram, copy your address, see your balance, and review recent activity—without leaving the chat.",
  },
  {
    title: "Contacts & safety",
    body: "Save addresses with simple names, send to a label instead of a long string, and use optional PIN, daily caps, and whitelist mode if you want tighter control.",
  },
  {
    title: "Reminders & swaps",
    body: "Set reminders for things you want to remember—they notify you; they don’t move funds on their own. For token swaps, we’ll point you to a TON exchange and your receive address.",
  },
  {
    title: "Prefer buttons?",
    body: "You don’t have to chat with the assistant. Open the menu or use classic commands for balance, address, send, history, and settings anytime.",
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
            TON · Telegram · AI assistant
          </p>
          <h1 className="font-display mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl sm:leading-[1.05]">
            Your TON wallet, in the chat you already use
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            TonID helps you manage TON from Telegram: talk naturally to check balances, prepare sends,
            keep an address book, and adjust safety settings—right beside your friends and channels.
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
                Telegram button coming soon—open the bot from your deploy settings once the link is
                configured.
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
            Private chats only—the bot isn’t meant for groups. Use the in-chat menu for quick actions
            if you’d rather tap than type.
          </p>
        </section>

        <section className="mx-auto mt-16 max-w-3xl rounded-3xl border border-foreground/10 bg-surface/80 px-6 py-8 shadow-sm backdrop-blur-sm sm:mt-20 sm:px-10 sm:py-10">
          <h2 className="font-display text-center text-xl font-bold text-foreground sm:text-2xl">
            How it feels to use
          </h2>
          <ol className="mt-6 space-y-4 text-left text-sm leading-relaxed text-muted sm:text-base">
            <li className="flex gap-3">
              <span className="font-display mt-0.5 shrink-0 font-bold text-accent">1</span>
              <span>
                <strong className="text-foreground">You write what you want.</strong> No need to
                memorize commands—ask for your balance, a transfer, or a new contact in everyday
                language.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-display mt-0.5 shrink-0 font-bold text-accent">2</span>
              <span>
                <strong className="text-foreground">TonID responds with clear next steps.</strong> It
                pulls the right information and sets things up so you’re never guessing what happened.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-display mt-0.5 shrink-0 font-bold text-accent">3</span>
              <span>
                <strong className="text-foreground">Money only moves when you say yes.</strong> Sends
                always wait for your confirmation (and your PIN, if you use one)—the assistant doesn’t
                spend on its own.
              </span>
            </li>
          </ol>
        </section>

        <section className="mt-20 sm:mt-28">
          <h2 className="font-display text-center text-2xl font-bold text-foreground sm:text-3xl">
            What you can do
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
            Everything below is available from one private chat with the bot.
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


      </main>

      <footer className="relative z-10 border-t border-foreground/10 py-8 text-center text-xs text-muted">
        TonID · TON on Telegram
      </footer>
    </div>
  );
}
