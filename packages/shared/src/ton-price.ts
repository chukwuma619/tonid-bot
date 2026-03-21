/**
 * Fiat → TON conversion for natural-language sends (CoinGecko public API).
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3/simple/price";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "Tonid-Bot/1.0 (Telegram; TON wallet)",
};

const priceCache = new Map<string, { result: TonPriceResult; expires: number }>();

export interface TonPriceResult {
  pricePerTon: number;
  currency: string;
  source: string;
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toLowerCase() || "usd";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTonPriceIn(currency: string): Promise<TonPriceResult | null> {
  const vs = normalizeCurrency(currency) || "usd";
  const cached = priceCache.get(vs);
  if (cached && cached.expires > Date.now()) return cached.result;

  const url = `${COINGECKO_BASE}?ids=the-open-network&vs_currencies=${encodeURIComponent(vs)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (res.status === 429 && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        return null;
      }
      const data = (await res.json()) as { "the-open-network"?: Record<string, number> };
      const prices = data["the-open-network"];
      if (!prices || typeof prices !== "object") return null;
      const price = prices[vs];
      if (typeof price !== "number" || price <= 0 || !Number.isFinite(price)) return null;
      const result: TonPriceResult = { pricePerTon: price, currency: vs, source: "CoinGecko" };
      priceCache.set(vs, { result, expires: Date.now() + CACHE_TTL_MS });
      return result;
    } catch {
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
      else return null;
    }
  }
  return null;
}

export async function fiatToTon(
  amount: number,
  currency: string
): Promise<{ amountTon: number; pricePerTon: number; currency: string } | null> {
  const result = await getTonPriceIn(currency);
  if (!result) return null;
  const amountTon = amount / result.pricePerTon;
  if (!Number.isFinite(amountTon) || amountTon <= 0) return null;
  return { amountTon, pricePerTon: result.pricePerTon, currency: result.currency };
}

export function formatFiat(amount: number, currency: string): string {
  const c = currency.toLowerCase();
  if (c === "usd") return `$${amount}`;
  if (c === "eur") return `€${amount}`;
  if (c === "gbp") return `£${amount}`;
  if (c === "jpy" || c === "cny") return `¥${amount}`;
  return `${amount} ${currency.toUpperCase()}`;
}
