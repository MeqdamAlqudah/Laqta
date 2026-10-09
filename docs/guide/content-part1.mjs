import * as D from "./diagrams.mjs";

const code = (s) => `<pre><code>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`;

export function cover() {
  return `
<section class="cover">
  <div class="cover-brand">LEADFLOW</div>
  <h1>Automated Lead Capture &amp;<br/>Follow-Up System</h1>
  <p class="cover-sub">Implementation guide — how it is built, how to run it, and why it is designed this way</p>
  <table class="cover-meta">
    <tr><td>Built from</td><td>LeadFlow Product Specification v1.0 (2 Oct 2026)</td></tr>
    <tr><td>Stack</td><td>Next.js 15 · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Claude API (optional)</td></tr>
    <tr><td>Covers</td><td>Setup &amp; database connection · architecture · data model · reliability · security · design patterns · the AI part explained from zero</td></tr>
    <tr><td>Source code</td><td>The project folder that contains this PDF (docs/LeadFlow-Guide.pdf)</td></tr>
  </table>
</section>`;
}

export function toc() {
  const items = [
    ["1", "The product in one page"], ["2", "Getting started"], ["3", "Connecting the database"],
    ["4", "Technology stack and why"], ["5", "Architecture"], ["6", "A lead's journey, step by step"],
    ["7", "Data model"], ["8", "Lead statuses (state machine)"], ["9", "Reliability: jobs, retries, idempotency"],
    ["10", "Security and privacy"], ["11", "Design patterns used"], ["12", "The AI part — explained from zero"],
    ["13", "Screens"], ["14", "API reference"], ["15", "Testing and acceptance"],
    ["16", "Deploying to production"], ["17", "Glossary"],
  ];
  return `<section class="chapter"><h1>Contents</h1><ol class="toc">${items.map(([n, t]) => `<li><span>${n}.</span> ${t}</li>`).join("")}</ol>
  <div class="callout"><b>How to read this guide.</b> Chapters 1–3 get the app running. Chapters 4–10 explain how it works. Chapter 11 names the design patterns and points to the exact files. Chapter 12 is a beginner-friendly introduction to the AI feature. Every file path is relative to the project folder.</div></section>`;
}

export function product() {
  return `<section class="chapter">
<h1><span>1</span> The product in one page</h1>
<p>LeadFlow makes sure that <b>every enquiry a business receives is captured, acknowledged and followed up</b>. The business might be a clinic, a real-estate office or a training centre. A customer fills a short form, or contacts the business through Google Forms, a Facebook/Instagram lead ad, or WhatsApp. Within seconds:</p>
<ul>
<li>the enquiry is <b>validated and saved once</b> in the database, with a reference like <code>LF-2026-1042</code>;</li>
<li>the customer gets a <b>confirmation</b> in English or Arabic;</li>
<li>the right staff member is <b>assigned by a clear rule</b> and alerted;</li>
<li>if nobody contacts the customer within the agreed time (the <b>SLA</b>, e.g. 15 working minutes), managers get an <b>escalation</b>;</li>
<li>everything that happens is recorded in an <b>audit timeline</b>, and managers see totals on a <b>dashboard</b>.</li>
</ul>
<h2>What the specification asked for, and where it lives</h2>
<table>
<tr><th>Spec requirement</th><th>Implemented in</th></tr>
<tr><td>Mobile-first bilingual form with consent, 5 UI states</td><td><code>src/app/f/[slug]/LeadForm.tsx</code></td></tr>
<tr><td>Lead API: validation, rate limit, dedupe, persistence</td><td><code>src/app/api/v1/public/leads/route.ts</code>, <code>src/services/lead-intake.service.ts</code></td></tr>
<tr><td>Channel adapters → one canonical lead</td><td><code>src/adapters/*</code>, <code>src/domain/lead/schema.ts</code></td></tr>
<tr><td>Database first, Sheets is only a synchronized copy</td><td>transactional outbox in <code>src/jobs/queue.ts</code></td></tr>
<tr><td>Statuses, immutable activity history, reopen</td><td><code>src/domain/lead/status.ts</code>, <code>lead_activities</code> table</td></tr>
<tr><td>Rule-based assignment, AI only suggests</td><td><code>src/services/assignment.ts</code>, <code>src/ai/*</code></td></tr>
<tr><td>Retries with backoff, dead-letter, operator alert, reconciliation</td><td><code>src/jobs/*</code></td></tr>
<tr><td>Dashboard, lead detail, configuration, integrations, users</td><td><code>src/app/(staff)/*</code></td></tr>
<tr><td>Roles Admin / Manager / Agent / Viewer, tenant isolation</td><td><code>src/lib/auth/rbac.ts</code>, <code>src/repositories/lead.repository.ts</code></td></tr>
<tr><td>Signed webhooks, encrypted secrets, redacted logs, retention</td><td><code>src/integrations/webhook-signature.ts</code>, <code>src/lib/crypto.ts</code>, <code>src/lib/logger.ts</code>, <code>src/jobs/sweeps.ts</code></td></tr>
<tr><td>OpenAPI contract</td><td><code>public/openapi.yaml</code></td></tr>
</table>
<div class="callout warn"><b>Not included in this MVP</b> (also excluded or deferred by the spec): payments, autonomous AI conversations, native mobile apps, and a full CRM. Two production items are flagged as next steps: <b>MFA for admins</b>, and a <b>shared (Redis) rate limiter</b> for when you run several servers.</div>
</section>`;
}

export function gettingStarted() {
  return `<section class="chapter">
<h1><span>2</span> Getting started</h1>
<h2>2.1 Install the tools (once)</h2>
<table>
<tr><th>Tool</th><th>What it is</th><th>Get it</th></tr>
<tr><td>Node.js 20 or newer</td><td>Runs JavaScript/TypeScript outside the browser. Next.js and the worker run on it.</td><td>nodejs.org (LTS)</td></tr>
<tr><td>Docker Desktop</td><td>Runs ready-made “containers”. We use it for PostgreSQL and a fake mail server, so you don't install them by hand.</td><td>docker.com</td></tr>
<tr><td>A code editor</td><td>VS Code is a good default.</td><td>code.visualstudio.com</td></tr>
</table>
<h2>2.2 Run it locally — the 7 commands</h2>
<p>Open a terminal in the project folder and run, one after the other:</p>
${code(`npm install            # 1. download all libraries listed in package.json
cp .env.example .env   # 2. create your private settings file
npm run db:up          # 3. start PostgreSQL + Mailpit in Docker
npm run db:migrate     # 4. create the tables (Prisma migrations)
npm run db:seed        # 5. add a demo clinic, staff accounts and sample leads
npm run dev            # 6. start the web app  -> http://localhost:3000
npm run worker         # 7. (second terminal) start the background job worker`)}
<p>Then open these pages:</p>
<table>
<tr><th>Address</th><th>What you will see</th></tr>
<tr><td>http://localhost:3000/f/smile-clinic</td><td>The customer form (add <code>?lang=ar</code> for Arabic, right-to-left)</td></tr>
<tr><td>http://localhost:3000/login</td><td>Staff sign-in. Demo users: <code>admin@</code>, <code>manager@</code>, <code>agent@</code>, <code>viewer@leadflow.local</code>, password <code>LeadFlow#2026</code></td></tr>
<tr><td>http://localhost:8025</td><td><b>Mailpit</b> — catches every email the app sends, so you can read confirmations and alerts safely</td></tr>
</table>
<div class="callout"><b>Why two processes?</b> <code>npm run dev</code> answers web requests. <code>npm run worker</code> sends emails, syncs data, runs AI and checks SLAs <i>in the background</i>. The customer never waits for those slow tasks. If the worker is stopped, nothing is lost: jobs wait in the database and run when it starts again.</div>
<h2>2.3 The .env file</h2>
<p><code>.env</code> holds settings and secrets. It is listed in <code>.gitignore</code>, so it is never committed. The important values:</p>
<table>
<tr><th>Variable</th><th>Meaning</th></tr>
<tr><td>DATABASE_URL / DIRECT_URL</td><td>Where PostgreSQL is (next chapter).</td></tr>
<tr><td>SESSION_SECRET</td><td>Signs the staff login cookie. Long random string.</td></tr>
<tr><td>ENCRYPTION_KEY</td><td>32 random bytes (base64). Encrypts integration secrets stored in the database.</td></tr>
<tr><td>WEBHOOK_SECRET</td><td>Shared with n8n/Make/Apps Script to sign inbound webhooks.</td></tr>
<tr><td>CRON_SECRET, SERVICE_API_TOKEN</td><td>Protect the cron endpoint and automation access to the staff API.</td></tr>
<tr><td>SMTP_HOST / PORT / USER / PASSWORD / FROM</td><td>Email server. Locally Mailpit (localhost:1025); in production e.g. Resend, SendGrid, Amazon SES.</td></tr>
<tr><td>ANTHROPIC_API_KEY, ANTHROPIC_MODEL</td><td>Optional. Turns on Claude for AI classification (chapter 12).</td></tr>
</table>
${code(`# generate a strong secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)}
<h2>2.4 Everyday commands</h2>
<table>
<tr><th>Command</th><th>Does</th></tr>
<tr><td>npm test</td><td>Runs the unit tests (vitest)</td></tr>
<tr><td>npm run lint</td><td>Type-checks the whole project</td></tr>
<tr><td>npm run build / npm start</td><td>Production build and server</td></tr>
<tr><td>npm run db:studio</td><td>Opens Prisma Studio, a web UI to browse the tables</td></tr>
<tr><td>npm run db:reset</td><td>Deletes all data, re-creates the tables and re-seeds</td></tr>
<tr><td>npm run docs:pdf</td><td>Rebuilds this PDF</td></tr>
</table>
</section>`;
}

export function database() {
  return `<section class="chapter">
<h1><span>3</span> Connecting the database</h1>
<p>LeadFlow stores everything in <b>PostgreSQL</b>, a reliable open-source relational database. The app never writes SQL by hand for normal work. It uses <b>Prisma</b>, an ORM (object-relational mapper). You describe tables once in <code>prisma/schema.prisma</code>, and Prisma:</p>
<ol>
<li>generates <b>migrations</b>: versioned SQL files in <code>prisma/migrations/</code> that create or alter tables;</li>
<li>generates a <b>typed client</b>, so <code>prisma.lead.findMany(...)</code> is checked by TypeScript;</li>
<li>reads the connection from <code>DATABASE_URL</code> in <code>.env</code>.</li>
</ol>
<h2>3.1 Anatomy of a connection string</h2>
${code(`postgresql://leadflow:leadflow@localhost:5432/leadflow?schema=public
            └─user─┘ └─pass─┘ └──host──┘ └port┘ └─db──┘ └─options─┘`)}
<h2>3.2 Option A — local Docker (default)</h2>
<p><code>docker-compose.yml</code> defines a <code>postgres:16</code> container whose user, password and database are all <code>leadflow</code>. Its data lives in a Docker volume, so it survives restarts. The default <code>.env</code> already points to it. Run <code>npm run db:up</code>, then <code>npm run db:migrate</code>.</p>
<h2>3.3 Option B — Supabase (managed, recommended by the spec)</h2>
<ol>
<li>Create a project on supabase.com and choose a region close to your users.</li>
<li>Go to <b>Project Settings → Database → Connection string</b>.</li>
<li>Copy the <b>Transaction pooler</b> URI (port 6543) into <code>DATABASE_URL</code> and append <code>?pgbouncer=true&amp;connection_limit=1</code>.</li>
<li>Copy the <b>Session / direct</b> URI (port 5432) into <code>DIRECT_URL</code>. Migrations need a direct connection.</li>
<li>Run <code>npm run db:deploy</code> (applies the migrations) and, for demo data, <code>npm run db:seed</code>.</li>
</ol>
${code(`DATABASE_URL="postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"`)}
<div class="callout"><b>Why two URLs?</b> Serverless hosting opens many short connections. A <i>pooler</i> (PgBouncer) shares a few real connections between them. Migrations use features a pooler doesn't support, so Prisma uses <code>DIRECT_URL</code> for those only.</div>
<h2>3.4 Option C — any other PostgreSQL</h2>
<p>Neon, Amazon RDS, Azure, DigitalOcean or a VPS all work. Put the provider's connection string in both variables, add <code>?sslmode=require</code> if asked, and run <code>npm run db:deploy</code>.</p>
<h2>3.5 Changing the schema later</h2>
${code(`1. edit prisma/schema.prisma            (e.g. add a column)
2. npm run db:migrate -- --name add_x   (creates prisma/migrations/<date>_add_x/ and applies it)
3. commit the new migration folder
4. on staging/production: npm run db:deploy`)}
<h2>3.6 Backups</h2>
<p>Supabase and other managed providers take automatic daily backups. Check the plan's retention. For a self-hosted database, schedule <code>pg_dump</code>. The spec requires a <b>tested restore</b>: restore the latest backup into a test database once a month and open the dashboard against it.</p>
${code(`pg_dump "$DIRECT_URL" -Fc -f leadflow-$(date +%F).dump        # backup
pg_restore -d "postgresql://...test-db..." leadflow-2026-10-09.dump  # restore test`)}
</section>`;
}

export function stack() {
  return `<section class="chapter">
<h1><span>4</span> Technology stack and why</h1>
<table>
<tr><th>Piece</th><th>Choice</th><th>Why this one</th></tr>
<tr><td>Web framework</td><td><b>Next.js 15</b> (App Router)</td><td>One project serves the public form, the staff dashboard <i>and</i> the API, which is the spec's preferred stack. Server Components read the database directly, so there's less code.</td></tr>
<tr><td>Language</td><td><b>TypeScript</b> (strict)</td><td>Types catch mistakes before running, and Prisma and Zod produce types automatically.</td></tr>
<tr><td>Database</td><td><b>PostgreSQL</b></td><td>Transactions, unique indexes and row locking (<code>SKIP LOCKED</code>) are exactly what idempotency and the job queue need.</td></tr>
<tr><td>ORM</td><td><b>Prisma 6</b></td><td>Schema file → migrations → typed queries. Easy to read for a new developer.</td></tr>
<tr><td>Validation</td><td><b>Zod 4</b></td><td>One schema both validates input and gives readable field-level errors (the 422 contract).</td></tr>
<tr><td>Phone numbers</td><td><b>libphonenumber-js</b></td><td>Google's phone rules: turns “079 000 0000” into <code>+962790000000</code> (E.164).</td></tr>
<tr><td>Auth</td><td><b>jose</b> (JWT) + <b>bcryptjs</b></td><td>A signed session cookie that works in middleware; bcrypt stores passwords as slow one-way hashes.</td></tr>
<tr><td>Email</td><td><b>Nodemailer</b> (SMTP)</td><td>Works with any provider. Mailpit catches mail locally.</td></tr>
<tr><td>Styling</td><td><b>Tailwind CSS 4</b></td><td>Fast, consistent, responsive styling with no separate CSS files to maintain.</td></tr>
<tr><td>AI (optional)</td><td><b>Claude</b> via <b>@anthropic-ai/sdk</b></td><td>Official SDK, structured outputs (guaranteed JSON shape). See chapter 12.</td></tr>
<tr><td>Tests</td><td><b>Vitest</b></td><td>Fast TypeScript-native unit tests.</td></tr>
<tr><td>Automation glue</td><td><b>n8n</b> or <b>Make</b> (outside the app)</td><td>As the spec recommends: connects Google Forms, Meta ads and WhatsApp providers without custom code per provider.</td></tr>
</table>
</section>`;
}

export function architecture() {
  return `<section class="chapter">
<h1><span>5</span> Architecture</h1>
<p>The spec asks for a modular design that can “start simple and later move from spreadsheets to a CRM”. The key decision is <b>database first</b>: a lead is committed to PostgreSQL <i>before</i> any email, sheet or AI call is attempted. External systems are reached only by background jobs that can be retried.</p>
${D.architecture()}
<h2>5.1 The parts</h2>
<table>
<tr><th>Part</th><th>Responsibility</th></tr>
<tr><td>Channels</td><td>Where enquiries come from. The website posts directly; other channels go through n8n/Make, which signs and forwards them.</td></tr>
<tr><td>Public API &amp; webhooks</td><td>Entry points. They do cheap checks first (body size, rate limit, form key or signature).</td></tr>
<tr><td>Intake pipeline</td><td>The heart of the system: turns any payload into a validated, de-duplicated, stored lead plus a list of follow-up jobs.</td></tr>
<tr><td>PostgreSQL</td><td>Source of truth for leads, history, consent, configuration <i>and</i> the job queue.</td></tr>
<tr><td>Worker</td><td>Runs jobs (email, alerts, sync, AI) and scheduled “sweeps” (SLA, reconciliation, daily summary, retention).</td></tr>
<tr><td>Staff UI + API</td><td>The operations dashboard: lists, detail, assignment, statuses, configuration, integrations, users.</td></tr>
</table>
${D.layers()}
<h2>5.2 Folder map</h2>
${code(`src/
├─ app/                     Next.js routes
│  ├─ f/[slug]/             public form (server page + client form)
│  ├─ login/  privacy/      public pages
│  ├─ (staff)/              dashboard, leads/[id], settings, integrations, users
│  └─ api/                  REST endpoints (route.ts files)
├─ adapters/                website, google-forms, meta-lead-ads, whatsapp
├─ domain/                  lead schema, normalization, status machine, SLA, settings
├─ services/                lead-intake, lead, assignment, dashboard, integration, security
├─ repositories/            lead.repository (tenant scoping, filters)
├─ jobs/                    queue, handlers, worker, sweeps
├─ integrations/            email, templates, webhook signing, outbound webhook
├─ ai/                      types, claude-classifier, rule-classifier, fallback factory
├─ lib/                     db, env, http errors, logger, crypto, rate-limit, auth/*, i18n
└─ middleware.ts            redirects signed-out users away from staff pages`)}
</section>`;
}

export function journey() {
  return `<section class="chapter">
<h1><span>6</span> A lead's journey, step by step</h1>
${D.sequence()}
${D.pipeline()}
<h2>6.1 Inside the request (stages 1–5)</h2>
<table>
<tr><th>#</th><th>Stage</th><th>What the code does</th><th>File</th></tr>
<tr><td>1</td><td>Receive</td><td>Assigns a request ID (returned in every response and log line). Rejects bodies over 16 KB. Allows 10 submissions per IP per minute. Looks up the organization by its public form key.</td><td>api/v1/public/leads/route.ts</td></tr>
<tr><td>2</td><td>Validate</td><td>The channel adapter maps the payload. Zod checks the name (2–80 chars), converts the phone to E.164 (Arabic digits supported), lower-cases the email, limits the message to 500 chars, requires consent and checks the service exists.</td><td>domain/lead/schema.ts</td></tr>
<tr><td>3</td><td>Protect</td><td>Hidden “website” honeypot field: if a bot fills it, we return a fake success and store nothing. Optional Cloudflare Turnstile CAPTCHA. HTML is stripped from text.</td><td>lead-intake.service.ts</td></tr>
<tr><td>4</td><td>Deduplicate</td><td>(a) Same idempotency key → return the original result (HTTP 200). (b) Same phone or email within 24 h on an open lead → add a “repeat enquiry” activity to that lead, alert its owner, and acknowledge the customer normally, without revealing their history.</td><td>lead-intake.service.ts</td></tr>
<tr><td>5</td><td>Persist</td><td>One transaction: increment the counter for the reference number, pick the owner by rule, insert the lead, CREATED and OWNER_CHANGED activities, consent evidence (hashed IP) and the follow-up jobs.</td><td>lead-intake.service.ts</td></tr>
</table>
<h2>6.2 After the response (stages 6–10)</h2>
<table>
<tr><th>#</th><th>Stage</th><th>Job / sweep</th><th>Behaviour</th></tr>
<tr><td>6</td><td>Acknowledge</td><td>SEND_CONFIRMATION</td><td>Email in the customer's language (Arabic = right-to-left), with the reference and expected response time. It never promises an appointment.</td></tr>
<tr><td>7</td><td>Notify</td><td>NOTIFY_STAFF, NOTIFY_WHATSAPP</td><td>Emails the owner, or managers if the lead is unassigned, with buttons: Open lead, Call, Mark contacted, Add note.</td></tr>
<tr><td>8</td><td>Synchronize</td><td>SYNC_SHEET + reconciliation sweep</td><td>Signed upsert to n8n/Make/Apps Script. The sweep re-queues any lead that is missing a sync.</td></tr>
<tr><td>9</td><td>Remind</td><td>SLA sweep → SLA_ESCALATION</td><td>A lead still NEW/ASSIGNED after <code>sla_due_at</code> gets exactly one escalation to managers and its owner.</td></tr>
<tr><td>10</td><td>Report</td><td>Dashboard + DAILY_SUMMARY</td><td>Live totals on the dashboard, plus one summary email per day after 18:00 local time.</td></tr>
</table>
<div class="callout"><b>The SLA counts working time.</b> <code>src/domain/sla.ts</code> adds the SLA minutes only inside working hours, in the organization's timezone. With Sunday–Thursday, 09:00–17:00 in Amman, a lead received Thursday at 16:55 with a 15-minute SLA is due <b>Sunday at 09:10</b>, not Thursday at 17:10. A unit test checks exactly this case.</div>
</section>`;
}

export function dataModel() {
  return `<section class="chapter">
<h1><span>7</span> Data model</h1>
<p>The spec's minimum entities, plus two small safety tables (<code>webhook_events</code> and <code>security_events</code>). Table names follow the spec. The Prisma models use camelCase names mapped to snake_case columns.</p>
${D.erd()}
<h2>7.1 Rules enforced by the schema</h2>
<table>
<tr><th>Rule</th><th>How</th></tr>
<tr><td>Every query is tenant-scoped</td><td><code>organization_id</code> on every business table; the repository always adds it.</td></tr>
<tr><td>No double submission</td><td>Unique index <code>(organization_id, idempotency_key)</code> on <code>leads</code>.</td></tr>
<tr><td>Unique human reference per organization</td><td>Unique <code>(organization_id, reference)</code>; the number comes from <code>organizations.lead_counter</code>, incremented inside the transaction.</td></tr>
<tr><td>Fast filters</td><td>Indexes on status, owner, created_at, phone_e164, email (each paired with organization_id).</td></tr>
<tr><td>Same job never queued twice</td><td>Unique <code>automation_jobs.idempotency_key</code>, e.g. <code>notify:&lt;leadId&gt;</code>, <code>sla:&lt;leadId&gt;</code>.</td></tr>
<tr><td>History is never edited</td><td><code>lead_activities</code> rows are only inserted (anonymization scrubs personal text but keeps the row).</td></tr>
<tr><td>Configuration is soft-deleted</td><td><code>services.deleted_at</code>; old leads keep their service.</td></tr>
<tr><td>Secrets are not readable in the DB</td><td><code>integrations.encrypted_credentials</code> = AES-256-GCM ciphertext.</td></tr>
</table>
<h2>7.2 Example: the canonical lead</h2>
<p>Every adapter produces this shape, exactly as in spec section 5:</p>
${code(`{
  "fullName": "Sample Customer",
  "phone": "+962790000000",
  "email": "customer@example.com",
  "serviceCode": "consultation",
  "preferredAt": "2026-10-05T14:00:00+03:00",
  "message": "Please call after 1 PM",
  "source": { "channel": "website", "campaign": "autumn_launch" },
  "language": "en",
  "consent": { "accepted": true, "policyVersion": "2026-10" },
  "idempotencyKey": "web-2e3d..."
}`)}
</section>`;
}

export function statuses() {
  return `<section class="chapter">
<h1><span>8</span> Lead statuses (state machine)</h1>
${D.stateMachine()}
<ul>
<li><b>Only allowed moves</b> are accepted. For example, NEW → WON is refused with a clear 422 message.</li>
<li><b>Every change writes an activity</b> with the actor, the time, and the old and new values. The detail page shows it as a timeline.</li>
<li><b>Reopening</b> a WON/LOST lead moves it back to CONTACTED; the earlier outcome stays in history.</li>
<li><b>Optimistic locking:</b> each lead has a <code>version</code> number. The browser sends the version it saw. If someone else changed the lead in the meantime, the update matches 0 rows and the API returns <b>409 Conflict</b> (“reload and try again”) instead of silently overwriting.</li>
<li>Logging a <b>call</b> or <b>message</b>, or moving to CONTACTED, records <code>first_contacted_at</code>, which feeds the “median first response” and “contacted within SLA” metrics.</li>
</ul>
${code(`// src/services/lead.service.ts (simplified)
const res = await tx.lead.updateMany({
  where: { id, organizationId: actor.organizationId, version: patch.version },
  data:  { ...changes, version: { increment: 1 } },
});
if (res.count === 0) throw new ApiError("CONFLICT", "This lead was changed by someone else.");`)}
</section>`;
}
