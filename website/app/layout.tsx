import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TonID Bot — TON wallet in Telegram",
  description:
    "Telegram bot for TON: wallet, send, history, address book, PIN, limits, reminders. Built for the Identity Hub TON AI Hackathon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
