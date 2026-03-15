export type AwaitingPinReason = "authorize_transfer" | "set_pin" | "change_pin_current" | "change_pin_new";

export interface AwaitingPinState {
  reason: AwaitingPinReason;
  since: number;
  attempts?: number;
}

const store = new Map<string, AwaitingPinState>();
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 5 * 60 * 1000;

function key(platform: string, userId: string): string {
  return `${platform}:${userId}`;
}

export function setAwaitingPin(
  platform: string,
  userId: string,
  reason: AwaitingPinReason,
  attempts = 0
): void {
  store.set(key(platform, userId), { reason, since: Date.now(), attempts });
}

export function getAwaitingPin(platform: string, userId: string): AwaitingPinState | undefined {
  const state = store.get(key(platform, userId));
  if (!state) return undefined;
  if (Date.now() - state.since > TIMEOUT_MS) {
    store.delete(key(platform, userId));
    return undefined;
  }
  return state;
}

export function clearAwaitingPin(platform: string, userId: string): void {
  store.delete(key(platform, userId));
}

export function incrementPinAttempts(platform: string, userId: string): number {
  const state = store.get(key(platform, userId));
  if (!state) return 0;
  const next = (state.attempts ?? 0) + 1;
  store.set(key(platform, userId), { ...state, attempts: next });
  return next;
}

export const MAX_PIN_ATTEMPTS = MAX_ATTEMPTS;
