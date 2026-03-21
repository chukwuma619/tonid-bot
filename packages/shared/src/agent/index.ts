import { generateText, stepCountIs } from "ai";
import { createAgentTools } from "./tools.js";
import { buildSystemPrompt } from "./prompts.js";

export type { AgentContext } from "./types.js";
import type { AgentContext } from "./types.js";



/**
 * Natural-language TON wallet assistant (Vercel AI SDK + tool calling).
 * Requires AI_GATEWAY_API_KEY (or provider env vars per your AI SDK setup).
 */
export async function runAgent(userMessage: string, context?: AgentContext): Promise<string> {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    return (
      "AI replies are not configured. Set **AI_GATEWAY_API_KEY** in your environment (see `env.example`), then restart the bot."
    );
  }

  const tools = createAgentTools(context);
  const systemPrompt = buildSystemPrompt({ defaultAddress: context?.defaultAddress });

  try {
    const result = await generateText({
      model: "anthropic/claude-sonnet-4",
      system: systemPrompt,
      prompt: userMessage,
      tools,
      stopWhen: stepCountIs(5),
    });
    const text = result.text?.trim();
    if (text) return text;
    return "_I ran the tools but got no text back. Try rephrasing or use /menu._";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Something went wrong talking to the AI: ${msg}`;
  }
}
