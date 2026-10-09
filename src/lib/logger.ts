// Structured JSON logger with automatic redaction of personal data
// (spec section 8: "redact phone, email, message and credentials").
const SENSITIVE_KEYS = new Set([
  "phone", "phonee164", "phone_e164", "email", "message", "fullname", "full_name", "name",
  "password", "passwordhash", "token", "secret", "authorization", "cookie", "apikey", "credentials",
]);

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => write("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => write("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => write("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => write("error", msg, f),
};
