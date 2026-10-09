// Central place for configuration. Reading env through one module makes it
// obvious which settings exist and gives sane development defaults.
function read(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  appUrl: read("APP_URL", "http://localhost:3000"),
  sessionSecret: read("SESSION_SECRET", "dev-only-session-secret-change-me-please"),
  encryptionKey: read("ENCRYPTION_KEY"),
  ipHashSalt: read("IP_HASH_SALT", "dev-salt"),
  cronSecret: read("CRON_SECRET"),
  serviceApiToken: read("SERVICE_API_TOKEN"),
  webhookSecret: read("WEBHOOK_SECRET"),
  smtp: {
    host: read("SMTP_HOST"),
    port: Number(read("SMTP_PORT", "587")),
    user: read("SMTP_USER"),
    password: read("SMTP_PASSWORD"),
    from: read("SMTP_FROM", "LeadFlow <no-reply@leadflow.local>"),
  },
  anthropicApiKey: read("ANTHROPIC_API_KEY"),
  anthropicModel: read("ANTHROPIC_MODEL", "claude-opus-5-5"),
  turnstileSecret: read("TURNSTILE_SECRET_KEY"),
  isProduction: process.env.NODE_ENV === "production",
};
