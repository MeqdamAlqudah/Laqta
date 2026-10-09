# LeadFlow — Automated Lead Capture & Follow-Up

A full-stack Next.js app built from the *LeadFlow Product Specification v1.0*. It captures an enquiry, validates it, stores it in PostgreSQL first, confirms receipt to the customer, alerts staff, syncs to Sheets/CRM, escalates overdue leads, and gives staff a small dashboard to work the pipeline. An optional AI step suggests a category and priority for each lead.

> **The full illustrated guide is [`docs/LeadFlow-Guide.pdf`](docs/LeadFlow-Guide.pdf).** It covers architecture diagrams, the data model, request flows, every design pattern used, and a plain-language explanation of the AI part.

---

## 1. What you need

| Tool | Why | Check |
|---|---|---|
| Node.js 20+ (22/24 recommended) | runs Next.js and the worker | `node -v` |
| Docker Desktop | runs PostgreSQL and Mailpit locally | `docker -v` |
| Chrome or Edge | only for rebuilding the PDF guide | — |

You don't need Docker if you use a hosted Postgres such as Supabase. See section 3.

## 2. Quick start (local, about 5 minutes)

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:up
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Then run these in **two terminals**:

```bash
npm run dev
```

```bash
npm run worker
```

Open:

| URL | What |
|---|---|
| http://localhost:3000 | Landing page |
| http://localhost:3000/f/smile-clinic | Public form (add `?lang=ar` for Arabic / RTL) |
| http://localhost:3000/login | Staff dashboard |
| http://localhost:8025 | **Mailpit**: every email the app sends lands here |
| http://localhost:3000/openapi.yaml | API contract |

**Demo accounts** (created by the seed, development only). The password for all of them is `LeadFlow#2026`:

| Email | Role |
|---|---|
| admin@leadflow.local | Admin: everything |
| manager@leadflow.local | Manager: all leads, assignment, exports |
| agent@leadflow.local / agent2@leadflow.local | Agent: own and unassigned leads |
| viewer@leadflow.local | Viewer: read-only, contact details masked |

> If port 3000 is busy, run `npx next dev -p 3001` and set `APP_URL=http://localhost:3001` in `.env` so links in emails are correct.

## 3. Connecting the database

The app talks to PostgreSQL through **Prisma** (`prisma/schema.prisma`). It reads two variables:

- `DATABASE_URL`: used by the running app.
- `DIRECT_URL`: used only by migrations. When you aren't behind a connection pooler, it's the same value.

### Option A: local Docker (default)
`npm run db:up` starts `postgres:16` with user, password and database all set to `leadflow`. The values in `.env.example` already point at it:
```
DATABASE_URL="postgresql://leadflow:leadflow@localhost:5432/leadflow?schema=public"
DIRECT_URL="postgresql://leadflow:leadflow@localhost:5432/leadflow?schema=public"
```

### Option B: Supabase (recommended managed option in the spec)
1. Create a project at supabase.com, then go to **Project Settings → Database → Connection string**.
2. Set `DATABASE_URL` to the **Transaction pooler** URI (port `6543`) and add `?pgbouncer=true&connection_limit=1`.
3. Set `DIRECT_URL` to the **Session / direct** URI (port `5432`).
4. Run `npm run db:deploy`, then `npm run db:seed`.

### Option C: any other managed PostgreSQL (Neon, RDS, Azure, …)
Put its connection string in both variables, add `?sslmode=require` if the provider needs it, then run `npm run db:deploy`.

### Useful DB commands
| Command | Does |
|---|---|
| `npm run db:migrate` | create/apply migrations in development |
| `npm run db:deploy` | apply existing migrations (staging/production) |
| `npm run db:seed` | load demo data (skips if it already exists) |
| `npm run db:reset` | **wipe** the DB, re-migrate and re-seed |
| `npm run db:studio` | browse tables in a web UI |

## 4. Environment variables

See [`.env.example`](.env.example). Each one is commented there. The important ones:

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | signs staff session cookies |
| `ENCRYPTION_KEY` | 32-byte base64 key; encrypts integration secrets in the DB |
| `WEBHOOK_SECRET` | verifies signed inbound webhooks (Google Forms, Meta, WhatsApp via n8n) |
| `CRON_SECRET` | protects `/api/v1/jobs/run` for serverless cron |
| `SERVICE_API_TOKEN` | lets n8n/Make call staff endpoints |
| `SMTP_*` | email delivery (Mailpit locally; any SMTP provider in production) |
| `ANTHROPIC_API_KEY` | *optional*; enables Claude classification (otherwise rule-based) |

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 5. Project structure

```
prisma/              schema.prisma (data model), migrations, seed.ts
src/
  adapters/          channel adapters: website, google-forms, meta, whatsapp  -> canonical lead
  domain/            pure business rules: lead schema, phone normalization, status machine, SLA, settings
  services/          use cases: lead intake pipeline, lead updates, assignment strategies, dashboard
  repositories/      tenant-scoped database queries
  jobs/              queue (outbox + retries), handlers (commands), worker, sweeps (SLA, reconciliation...)
  integrations/      email providers, templates, signed outbound webhooks
  ai/                classifier interface, Claude classifier, rule-based fallback
  lib/               db client, auth (session, RBAC), logger with redaction, crypto, rate limit, http errors
  app/               Next.js pages (public form, staff UI) and API routes under app/api
scripts/worker.ts    background worker process
tests/               unit tests (vitest)
docs/                guide (HTML -> PDF), screenshots, Google Apps Script samples
public/openapi.yaml  API contract
```

## 6. How a lead flows (short version)

1. **Receive**: `POST /api/v1/public/leads` checks size, rate limit and form key.
2. **Validate**: the adapter maps the payload to the canonical lead, then Zod validates and normalizes it (phone to E.164).
3. **Protect**: honeypot field and optional Cloudflare Turnstile.
4. **Idempotency / dedupe**: a replayed key returns the original result. The same phone or email within 24 h is merged into the existing lead.
5. **Persist**: one DB transaction writes the lead, its activities and consent, assigns an owner by rule, and **enqueues jobs** (transactional outbox).
6. The API answers **201** with a reference like `LF-2026-1042`.
7. Jobs run asynchronously, each retried independently with exponential backoff: confirmation email, staff alert, Sheets sync, WhatsApp alert, AI classification.
8. Sweeps escalate overdue leads exactly once, re-sync anything missing, send a daily summary, and anonymize data past its retention period.

## 7. Background jobs in production

Choose one:
- **Long-running worker**: run `npm run worker` as a second process (Docker, PM2, Railway, Render…). It's safe to run several copies.
- **Serverless cron**: call `POST /api/v1/jobs/run` every minute with `Authorization: Bearer $CRON_SECRET`. On Vercel, add a cron in `vercel.json`.

## 8. Integrations

| Integration | Setup |
|---|---|
| Email | `SMTP_*` env vars, e.g. Resend, SendGrid, Mailgun, Amazon SES SMTP |
| Google Sheets | `docs/integrations/sheets-receiver-apps-script.gs`, or an n8n/Make webhook. Configure the URL and secret in **Integrations** |
| Google Forms | `docs/integrations/google-forms-apps-script.gs` posts signed submissions to `/api/v1/webhooks/google-forms?org=<slug>` |
| Meta lead ads / WhatsApp | n8n/Make receives the provider webhook, maps it, and forwards it signed to `/api/v1/webhooks/meta` or `/whatsapp` |
| AI | set `ANTHROPIC_API_KEY`; enable or disable under **Integrations → AI** |

Webhook signature: `x-leadflow-timestamp: <unix seconds>` and `x-leadflow-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>`.

## 9. Tests and checks

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

## 10. Rebuilding the PDF guide

With the app running and seeded, set the URL your app is running on and run:

```bash
node docs/screenshots.mjs http://localhost:3000
```

```bash
npm run docs:pdf
```

## 11. Known MVP limits and next steps

- MFA for admins (spec section 8) is not implemented yet. Add TOTP, or move auth to Supabase Auth / Auth.js.
- The rate limiter is in-memory, which is fine for one server. Swap in Redis/Upstash when you run several.
- The staff UI is English-only. The public form and customer emails are English and Arabic.
- Meta and WhatsApp adapters expect n8n/Make to fetch and forward the payload. Direct Graph API calls are not included.
