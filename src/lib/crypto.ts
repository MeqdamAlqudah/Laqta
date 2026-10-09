import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function key(): Buffer {
  const k = Buffer.from(env.encryptionKey, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  return k;
}

/** AES-256-GCM: encrypts integration credentials before they reach the database. */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptJson<T = Record<string, string>>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv!);
  decipher.setAuthTag(tag!);
  const text = Buffer.concat([decipher.update(data!), decipher.final()]).toString("utf8");
  return JSON.parse(text) as T;
}

/** One-way hash so consent evidence never stores a raw IP address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${env.ipHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

export function hmacSha256(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
