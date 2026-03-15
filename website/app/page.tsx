export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <main className="w-full max-w-2xl space-y-10 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            TonID Bot
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            TON wallet in Telegram — send, balance, history, address book, PIN & limits
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Built for the Identity Hub TON AI Hackathon
          </h2>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            This project is a Telegram bot that gives you a TON wallet: create an address, check
            balance, send TON, view history, and use natural language (e.g. “What’s my balance?”).
            It includes an address book, optional PIN, spending limits, and reminders.
          </p>
          <a
            href="https://identityhub.app/contests/ai-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-blue-600 hover:underline dark:text-blue-400"
          >
            Identity Hub — TON AI Hackathon →
          </a>
        </div>
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-500">
          <p>Run the bot locally with <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">pnpm dev:bot</code>. Set <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">TELEGRAM_BOT_TOKEN</code> and <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">REDIS_URL</code> in <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">.env</code>.</p>
        </div>
      </main>
    </div>
  );
}
