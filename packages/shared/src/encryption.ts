import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64 || !/^[0-9a-fA-F]+$/.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decrypt(value: string): string {
  const key = getKey();
  if (!key) return value;
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return value;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - AUTH_TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN, buf.length - AUTH_TAG_LEN);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    return value;
  }
}

export function hasEncryptionKey(): boolean {
  return getKey() !== null;
}
