import "dotenv/config";
import express from "express";
import { Bot, webhookCallback } from "grammy";
import { run } from "./bot.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const bot = new Bot(token);

run(bot);

const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

if (webhookUrl) {
  await bot.api.setWebhook(webhookUrl, {
    secret_token: secretToken || undefined,
  });
  const app = express();
  app.use(express.json());
  const handleWebhook = webhookCallback(bot, "express", {
    secretToken: secretToken || undefined,
  });
  app.post("/webhook", handleWebhook);
  app.post("/api/webhooks/telegram", handleWebhook);
  app.get("/", (_req, res) => {
    res.status(200).send("ok");
  });
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => {
    console.log(`Webhook server listening on port ${port}`);
  });
} else {
  console.log("Long polling (no TELEGRAM_WEBHOOK_URL)");
  bot.start();
}
