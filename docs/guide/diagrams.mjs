import { svg, box, cylinder, arrow, path, curve, circle, frame, chevron, text, COLORS } from "./svg.mjs";

export function architecture() {
  let b = "";
  const ch = [
    ["Website form", ["Next.js /f/[slug]", "EN + AR, mobile first"], "blue"],
    ["Google Forms", ["optional low-cost channel"], "amber"],
    ["Meta lead ads", ["Facebook / Instagram"], "amber"],
    ["WhatsApp", ["Business API provider"], "amber"],
    ["Staff browser", ["dashboard, phone, laptop"], "violet"],
  ];
  ch.forEach(([t, l, c], i) => (b += box(20 + i * 175, 20, 160, 62, t, l, { color: c, titleSize: 13.5, size: 10.5 })));
  b += box(195, 122, 510, 50, "n8n / Make  (automation glue, optional)", ["receives provider events, maps fields, signs and forwards"], { color: "slate", dashed: true, titleSize: 13, size: 10.5 });
  b += arrow(275, 82, 275, 120) + arrow(450, 82, 450, 120) + arrow(625, 82, 625, 120);

  b += frame(10, 210, 880, 150, "Next.js application (one deployable: pages + API)", "blue", 320);
  b += box(30, 235, 260, 105, "Public API & webhooks", ["POST /api/v1/public/leads", "POST /api/v1/webhooks/{provider}", "size · rate limit · form key · HMAC"], { color: "white" });
  b += box(320, 235, 260, 105, "Lead intake pipeline", ["adapter → validate → protect", "idempotency → dedupe → persist", "+ enqueue follow-up jobs"], { color: "green" });
  b += box(610, 235, 260, 105, "Staff UI + Staff API", ["leads, detail, settings, users", "/api/v1/leads · PATCH · activities", "session · RBAC · tenant scope"], { color: "violet" });
  b += arrow(100, 82, 100, 233, { lbl: "JSON POST", dy: -25 });
  b += arrow(260, 172, 260, 233, { lbl: "signed webhook", dy: -8 });
  b += arrow(800, 82, 800, 233, { lbl: "HTTPS + cookie", dy: 40 });
  b += arrow(290, 287, 318, 287);

  b += cylinder(190, 410, 250, 135, "PostgreSQL", ["leads · activities · consents", "automation_jobs (the queue)", "single source of truth"]);
  b += box(540, 420, 330, 115, "Background worker", ["npm run worker  — or —  cron → /api/v1/jobs/run", "claims due jobs (FOR UPDATE SKIP LOCKED)", "retries with backoff · dead-letter · sweeps"], { color: "amber" });
  b += arrow(430, 340, 360, 408, { lbl: "1 transaction", dx: -30 });
  b += arrow(690, 340, 430, 420, { lbl: "Prisma queries", dx: 30, dy: -8 });
  b += arrow(442, 478, 538, 478, { lbl: "claim / update", both: true, dy: -14 });

  const outs = [["Email (SMTP)", ["confirmation · alerts"]], ["Sheets / CRM", ["signed upsert webhook"]], ["WhatsApp alert", ["via n8n → provider"]], ["Claude API", ["AI classification"]]];
  outs.forEach(([t, l], i) => {
    const x = 190 + i * 172;
    b += box(x, 585, 160, 52, t, l, { color: i === 3 ? "violet" : "cyan", titleSize: 13, size: 10.5 });
    b += arrow(705, 535, x + 80, 583);
  });
  return svg(900, 650, b, "Figure 1 — System architecture. Every channel ends in the same API and pipeline; the database is written before anything external happens.");
}

export function layers() {
  const rows = [
    ["Presentation — src/app/(pages)", "Public form and staff screens (React Server Components + small Client Components)", "violet"],
    ["API layer — src/app/api/**/route.ts", "HTTP route handlers: authenticate, parse input, map errors to the error contract", "blue"],
    ["Application services — src/services, src/jobs", "Use cases: intake pipeline, lead updates, assignment, job handlers, sweeps", "green"],
    ["Domain — src/domain, src/adapters, src/ai", "Pure rules: canonical lead, status machine, SLA maths, channel adapters, classifiers", "amber"],
    ["Data access — src/repositories", "Tenant-scoped queries (organization_id is always applied)", "cyan"],
    ["Infrastructure — src/lib, src/integrations, prisma", "PostgreSQL, SMTP, outbound webhooks, Anthropic SDK, crypto, logging, rate limiting", "slate"],
  ];
  let b = "";
  rows.forEach(([t, l, c], i) => (b += box(70, 15 + i * 64, 810, 52, t, [l], { color: c, align: "start", titleSize: 13.5, size: 11.5 })));
  b += arrow(35, 20, 35, 390);
  b += `<text x="25" y="210" font-size="12" fill="#475569" transform="rotate(-90 25 210)" text-anchor="middle">calls / depends on</text>`;
  return svg(900, 400, b, "Figure 2 — Layered structure. Upper layers call lower layers, never the reverse; the domain layer has no database or HTTP code.");
}

export function sequence() {
  const P = [["Customer", 70], ["Public API", 220], ["Intake pipeline", 375], ["PostgreSQL", 530], ["Worker", 690], ["Email / Staff", 835]];
  let b = "";
  for (const [n, x] of P) {
    b += box(x - 65, 12, 130, 38, n, [], { color: n === "PostgreSQL" ? "green" : n === "Worker" ? "amber" : "blue", titleSize: 12.5 });
    b += `<line x1="${x}" y1="50" x2="${x}" y2="545" stroke="#cbd5e1" stroke-dasharray="4 4"/>`;
  }
  const X = Object.fromEntries(P);
  const msg = (from, to, y, lbl, o = {}) => arrow(X[from], y, X[to], y, { lbl, dy: -8, ...o });
  const self = (who, y, lbl) =>
    path([[X[who], y], [X[who] + 30, y], [X[who] + 30, y + 14], [X[who] + 3, y + 14]]) + text(X[who] + 38, y + 11, lbl, { size: 11, anchor: "start", color: "#475569" });
  b += msg("Customer", "Public API", 85, "POST /api/v1/public/leads");
  b += self("Public API", 100, "size, rate limit, form key");
  b += msg("Public API", "Intake pipeline", 145, "intakeLead()");
  b += self("Intake pipeline", 160, "adapter + Zod validate");
  b += msg("Intake pipeline", "PostgreSQL", 205, "idempotency / duplicate lookup");
  b += msg("Intake pipeline", "PostgreSQL", 245, "BEGIN · lead+activity+consent+jobs · COMMIT", { color: "green" });
  b += msg("Intake pipeline", "Public API", 285, "result", { dashed: true });
  b += msg("Public API", "Customer", 320, "201 { reference: LF-2026-1042 }", { dashed: true, color: "green" });
  b += `<line x1="20" y1="350" x2="880" y2="350" stroke="#f59e0b" stroke-width="1.4" stroke-dasharray="8 5"/>`;
  b += text(450, 345, "response already sent — everything below is asynchronous", { size: 11.5, weight: 600, color: "#b45309" });
  b += msg("Worker", "PostgreSQL", 385, "claim due jobs (SKIP LOCKED)");
  b += msg("Worker", "Email / Staff", 425, "confirmation + staff alert");
  b += msg("Worker", "PostgreSQL", 465, "SUCCEEDED, or retry later");
  b += self("Worker", 490, "");
  b += text(690 - 10, 530, "AI classify · Sheets sync · each independent", { size: 11, anchor: "end", color: "#475569" });
  return svg(900, 555, b, "Figure 3 — What happens when a customer presses “Send”. The customer waits only for the database commit (~100 ms).");
}

export function pipeline() {
  let b = text(10, 24, "Synchronous — inside the HTTP request (spec target: respond within 2 s)", { size: 12.5, weight: 700, anchor: "start", color: "#047857" });
  const s1 = [["Receive", "request id · limits"], ["Validate", "normalize phone/email"], ["Protect", "honeypot · CAPTCHA"], ["Deduplicate", "replay & 24 h match"], ["Persist", "one DB transaction"]];
  const s2 = [["Acknowledge", "customer email"], ["Notify", "staff email/WhatsApp"], ["Synchronize", "Sheets / CRM"], ["Remind", "SLA escalation"], ["Report", "dashboard + summary"]];
  s1.forEach(([t, s], i) => (b += chevron(8 + i * 177, 36, 182, 72, i + 1, t, s, "green")));
  b += text(10, 150, "Asynchronous — automation jobs and scheduled sweeps (each retried independently)", { size: 12.5, weight: 700, anchor: "start", color: "#b45309" });
  s2.forEach(([t, s], i) => (b += chevron(8 + i * 177, 162, 182, 72, i + 6, t, s, "amber")));
  return svg(900, 245, b, "Figure 4 — The 10-stage workflow from the specification and where each stage runs.");
}

function entity(x, y, w, name, fields, color = "blue") {
  const c = COLORS[color];
  const h = 28 + fields.length * 17 + 8;
  let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fff" stroke="${c.s}" stroke-width="1.6"/>`;
  o += `<path d="M${x},${y + 28} v-20 a8,8 0 0 1 8,-8 h${w - 16} a8,8 0 0 1 8,8 v20 z" fill="${c.s}"/>`;
  o += text(x + w / 2, y + 19, name, { size: 13, weight: 700, color: "#fff" });
  fields.forEach((f, i) => {
    const key = f.startsWith("id") && i === 0;
    const fk = f.includes("FK");
    o += text(x + 10, y + 46 + i * 17, f, { size: 11, anchor: "start", color: key ? "#b45309" : fk ? c.t : "#334155", weight: key ? 700 : 400 });
  });
  return o;
}

function rel(x1, y1, x2, y2, a = "1", z = "*", pts) {
  const p = pts ?? [[x1, y1], [x2, y2]];
  const d = p.map((q, i) => `${i ? "L" : "M"}${q[0]},${q[1]}`).join(" ");
  const [ex, ey] = p[p.length - 1];
  return `<path d="${d}" fill="none" stroke="#64748b" stroke-width="1.4"/>` +
    text(p[0][0] + 7, p[0][1] - 5, a, { size: 12, weight: 700, color: "#475569" }) + text(ex - 9, ey - 5, z === "*" ? "∗" : z, { size: 14, weight: 700, color: "#475569" });
}

export function erd() {
  let b = "";
  b += entity(15, 15, 205, "organizations", ["id (PK)", "name", "slug (unique)", "timezone", "public_key (unique)", "lead_counter", "settings_json"], "slate");
  b += entity(15, 215, 205, "users", ["id (PK)", "organization_id FK", "name, email (unique)", "password_hash", "role: ADMIN…VIEWER", "active"], "violet");
  b += entity(15, 400, 205, "services", ["id (PK)", "organization_id FK", "code", "name_en / name_ar", "routing_rule (json)", "deleted_at (soft delete)"], "cyan");
  b += entity(320, 120, 250, "leads", ["id (PK)", "organization_id FK", "reference  LF-2026-1042", "full_name · phone_e164 · email", "service_id FK · owner_id FK", "message · language", "status", "source_channel · source_campaign", "idempotency_key", "version (optimistic lock)", "sla_due_at · sla_escalated_at", "first_contacted_at", "ai_category · ai_priority · ai_reason", "anonymized_at · created_at"], "blue");
  b += entity(665, 15, 220, "lead_activities", ["id (PK)", "lead_id FK", "type (CREATED, CALL…)", "actor_id FK (null = system)", "old_value / new_value", "metadata_json · created_at"], "green");
  b += entity(665, 190, 220, "automation_jobs", ["id (PK)", "organization_id FK · lead_id FK", "job_type · state", "attempts / max_attempts", "next_attempt_at · locked_at", "idempotency_key (unique)", "last_error"], "amber");
  b += entity(665, 380, 220, "consents", ["id (PK)", "lead_id FK", "consent_type", "policy_version", "captured_at · ip_hash"], "pink");
  b += entity(320, 450, 250, "integrations", ["id (PK)", "organization_id FK", "provider · enabled", "encrypted_credentials (AES-GCM)", "configuration_json", "last_success_at · last_error"], "red");
  b += box(665, 525, 220, 70, "webhook_events · security_events", ["replay protection · denied-access audit"], { color: "slate", titleSize: 11.5, size: 10.5 });
  b += rel(117, 170, 117, 215);
  b += rel(220, 60, 320, 160, "1", "*", [[220, 60], [270, 60], [270, 160], [320, 160]]);
  b += rel(220, 270, 320, 270, "1", "*");
  b += rel(220, 440, 320, 330, "1", "*", [[220, 440], [285, 440], [285, 330], [320, 330]]);
  b += rel(220, 110, 320, 520, "1", "*", [[220, 110], [295, 110], [295, 520], [320, 520]]);
  b += rel(570, 165, 665, 70, "1", "*", [[570, 165], [620, 165], [620, 70], [665, 70]]);
  b += rel(570, 260, 665, 260, "1", "*");
  b += rel(570, 380, 665, 430, "1", "*", [[570, 380], [620, 380], [620, 430], [665, 430]]);
  return svg(900, 610, b, "Figure 5 — Data model (entity-relationship diagram). 1 → ∗ means “one row relates to many rows”. Every business table carries organization_id.");
}

export function stateMachine() {
  let b = "";
  const N = { NEW: [85, 205], ASSIGNED: [250, 205], CONTACTED: [440, 205], QUALIFIED: [630, 115], WON: [810, 205], LOST: [630, 325] };
  b += curve(785, 165, 620, -95, 470, 166, { lbl: "reopen (history kept)", color: "green", dashed: true, lx: 625, ly: 22 });
  b += arrow(131, 197, 204, 197, { lbl: "assign", dy: -10 });
  b += curve(204, 222, 168, 262, 128, 224, { lbl: "unassign", ly: 258 });
  b += curve(110, 166, 250, 85, 400, 172, { lbl: "contacted", ly: 112 });
  b += arrow(296, 205, 394, 205, { lbl: "first contact", dy: -10 });
  b += arrow(474, 175, 588, 125, { lbl: "qualified", dx: -10, dy: -8 });
  b += curve(596, 148, 560, 200, 486, 215, { lbl: "back", lx: 548, ly: 196 });
  b += arrow(486, 205, 764, 205, { lbl: "won", dx: 70, dy: -9 });
  b += arrow(672, 132, 768, 186, { lbl: "won", dy: -6 });
  b += arrow(470, 240, 588, 305, { lbl: "lost", dy: 6 });
  b += arrow(630, 161, 630, 279, { lbl: "lost", dy: 25 });
  b += curve(108, 246, 280, 400, 586, 338, { lbl: "lost", ly: 340 });
  b += curve(592, 350, 470, 380, 446, 252, { lbl: "reopen", color: "green", dashed: true, lx: 480, ly: 352 });
  b += circle(...N.NEW, 46, "NEW", "captured", "blue");
  b += circle(...N.ASSIGNED, 46, "ASSIGNED", "owner set", "violet");
  b += circle(...N.CONTACTED, 46, "CONTACTED", "1st response", "cyan");
  b += circle(...N.QUALIFIED, 46, "QUALIFIED", "real opportunity", "amber");
  b += circle(...N.WON, 46, "WON", "final", "green");
  b += circle(...N.LOST, 46, "LOST", "final", "red");
  return svg(900, 385, b, "Figure 6 — Lead status state machine (src/domain/lead/status.ts). Any transition not drawn is rejected with 422. “Overdue” is not a status: it means NEW/ASSIGNED after sla_due_at.");
}

export function jobLifecycle() {
  let b = "";
  b += box(30, 70, 150, 60, "PENDING", ["waiting for next_attempt_at"], { color: "blue", size: 10.5 });
  b += box(330, 70, 150, 60, "RUNNING", ["locked by one worker"], { color: "amber", size: 10.5 });
  b += box(660, 70, 200, 60, "SUCCEEDED", ["integration health ✓"], { color: "green", size: 10.5 });
  b += box(660, 185, 200, 60, "DEAD (dead-letter)", ["admin emailed · visible in UI"], { color: "red", size: 10.5 });
  b += arrow(180, 92, 328, 92, { lbl: "claimed (attempts + 1)", dy: -10 });
  b += arrow(480, 92, 658, 92, { lbl: "handler finished", dy: -10 });
  b += curve(400, 132, 270, 200, 120, 133, { lbl: "error → retry after backoff", color: "red", lx: 250, ly: 172 });
  b += path([[480, 120], [570, 120], [570, 215], [658, 215]], { lbl: "error & attempts = max", color: "red", at: 1, dx: -2 });
  b += path([[760, 245], [760, 270], [100, 270], [100, 132]], { lbl: "operator clicks “Retry” on Integrations page", dashed: true, at: 1, color: "green" });
  b += curve(370, 70, 405, 5, 440, 70, { lbl: "worker crashed > 5 min → reclaimed", ly: 30 });
  b += text(30, 320, "Backoff schedule:", { size: 12, weight: 700, anchor: "start" });
  const steps = ["fail #1", "+30 s", "fail #2", "+1 min", "fail #3", "+2 min", "fail #4", "+4 min", "fail #5 → DEAD"];
  steps.forEach((s, i) => {
    const x = 160 + i * 82;
    b += i % 2 === 0
      ? `<circle cx="${x}" cy="316" r="5" fill="${i === 8 ? "#dc2626" : "#f59e0b"}"/>` + text(x, 338, s, { size: 10.5 })
      : `<line x1="${x - 36}" y1="316" x2="${x + 36}" y2="316" stroke="#cbd5e1" stroke-width="3"/>` + text(x, 308, s, { size: 10.5, color: "#64748b" });
  });
  return svg(900, 350, b, "Figure 7 — Life of an automation job (src/jobs/queue.ts). Confirmation, alert, sync and AI are separate jobs, so one failing never blocks the others.");
}

export function authFlow() {
  const steps = [
    ["Login", ["bcrypt check", "5 tries / 15 min"], "violet"],
    ["Session cookie", ["signed JWT (HS256)", "httpOnly · 12 h"], "violet"],
    ["Middleware", ["staff pages need", "a valid token"], "blue"],
    ["requireApiActor", ["re-loads user from DB", "deactivated = out"], "blue"],
    ["can(role, perm)", ["single policy table", "denied → logged"], "amber"],
    ["scopeFor(actor)", ["WHERE organization_id", "agents: own+unassigned"], "green"],
  ];
  let b = "";
  steps.forEach(([t, l, c], i) => {
    b += box(10 + i * 149, 25, 135, 90, t, l, { color: c, titleSize: 12.5, size: 10.5 });
    if (i < steps.length - 1) b += arrow(145 + i * 149, 70, 157 + i * 149, 70);
  });
  return svg(900, 135, b, "Figure 8 — Every staff request passes the same chain: identity → permission → tenant scope.");
}

export function webhookSignature() {
  let b = "";
  b += box(15, 30, 255, 220, "Sender (n8n / Apps Script)", ["1. body = raw JSON text", "2. ts = current unix seconds", "3. sig = HMAC-SHA256(secret,", "        ts + \".\" + body)", "4. POST with headers:", "   x-leadflow-timestamp: ts", "   x-leadflow-signature: sha256=…"], { color: "slate", align: "start", size: 11 });
  b += arrow(270, 140, 345, 140, { lbl: "HTTPS", dy: -10 });
  b += box(345, 15, 335, 250, "LeadFlow receiver", ["a. |now − ts| ≤ 300 s ?  (old requests rejected)", "b. recompute HMAC with the shared secret", "c. compare in constant time (no timing leaks)", "d. store sha256(signature) in webhook_events", "    unique index → exact replay = 409", "e. find organization (?org=slug)", "f. adapter → canonical lead → intake pipeline"], { color: "blue", align: "start", size: 11 });
  b += box(735, 30, 150, 85, "Rejected", ["401 / 409", "security_events row"], { color: "red", size: 10.5 });
  b += box(735, 160, 150, 85, "Accepted", ["201 lead created", "200 if replayed key"], { color: "green", size: 10.5 });
  b += arrow(680, 90, 733, 75, { color: "red" }) + arrow(680, 190, 733, 200, { color: "green" });
  return svg(900, 275, b, "Figure 9 — Signed webhooks: proving a request really comes from your automation and has not been replayed.");
}

export function llmBasics() {
  let b = "";
  b += box(10, 40, 180, 110, "1. Text in", ["“Severe tooth pain,", "can I come today?”"], { color: "slate" });
  b += box(230, 40, 200, 110, "2. Tokens", ["Severe | tooth | pain | ,", "can | I | come | today | ?", "(≈ ¾ of a word each)"], { color: "blue" });
  b += box(470, 25, 220, 140, "3. The model", ["a huge neural network", "trained on lots of text", "predicts the most likely", "next token, again and again"], { color: "violet" });
  b += box(730, 40, 160, 110, "4. Text out", ["{ \"priority\": \"HIGH\",", "  \"category\": … }"], { color: "green" });
  b += arrow(190, 95, 228, 95) + arrow(430, 95, 468, 95) + arrow(690, 95, 728, 95);
  return svg(900, 180, b, "Figure 10 — What a Large Language Model (LLM) does, in one picture.");
}

export function aiFlow() {
  let b = "";
  b += box(10, 30, 140, 75, "Lead saved", ["in PostgreSQL"], { color: "green" });
  b += box(185, 30, 150, 75, "AI_CLASSIFY job", ["queued in the same", "transaction"], { color: "amber", size: 10.5 });
  b += box(370, 30, 180, 75, "Build the request", ["system prompt (rules)", "+ enquiry text only"], { color: "slate", size: 10.5 });
  b += box(585, 30, 145, 75, "Claude API", ["structured output", "(JSON schema)"], { color: "violet", size: 10.5 });
  b += box(765, 30, 125, 75, "Valid JSON", ["category · priority", "reason · draft"], { color: "blue", size: 10 });
  b += arrow(150, 67, 183, 67) + arrow(335, 67, 368, 67) + arrow(550, 67, 583, 67) + arrow(730, 67, 763, 67);
  b += box(585, 175, 145, 75, "Rule classifier", ["EN + AR keywords", "never fails"], { color: "amber", size: 10.5 });
  b += arrow(657, 105, 657, 173, { lbl: "error / refusal / no key", color: "red", dx: 0 });
  b += box(765, 175, 125, 75, "Saved on lead", ["ai_category", "ai_priority, reason"], { color: "green", size: 10 });
  b += arrow(827, 105, 827, 173) + arrow(730, 212, 763, 212);
  b += box(645, 300, 245, 70, "Shown to staff", ["priority badge + draft reply", "a human decides what to do"], { color: "violet", size: 10.5 });
  b += arrow(827, 250, 800, 298);
  b += box(10, 150, 540, 225, "Guard-rails built into src/ai", [
    "• No name, phone or email is sent — only the message, service and channel",
    "• Enquiry is wrapped in <enquiry> tags and declared as data, not instructions",
    "• Output must match a schema; category must be one of your service codes",
    "• Runs after the customer got their answer — AI can never slow the form",
    "• Advisory only: owner assignment stays rule-based and explainable",
    "• Any failure falls back to keyword rules, so the lead is still classified",
    "• Low “effort” setting: classification is simple, so it stays fast and cheap",
  ], { color: "slate", dashed: true, align: "start", size: 11.5, titleSize: 13.5 });
  return svg(900, 385, b, "Figure 11 — How LeadFlow uses AI (src/ai/*, job handler aiClassify in src/jobs/handlers.ts).");
}

/** Generic "client → interface ← implementations" diagram for pattern pages. */
export function interfaceDiagram(client, iface, ifaceLines, impls, { color = "blue", caption } = {}) {
  let b = "";
  b += box(20, 25, 200, 70, client[0], client[1], { color: "slate", size: 10.5 });
  b += box(330, 15, 260, 90, iface, ifaceLines, { color, size: 10.5 });
  b += arrow(220, 60, 328, 60, { lbl: "uses", dy: -9 });
  const w = Math.min(190, (860 - (impls.length - 1) * 14) / impls.length);
  const total = impls.length * w + (impls.length - 1) * 14;
  const start = (900 - total) / 2;
  impls.forEach(([t, l], i) => {
    const x = start + i * (w + 14);
    b += box(x, 155, w, 62, t, l, { color: "white", titleSize: w < 150 ? 10.5 : 12, size: 10 });
    b += path([[x + w / 2, 155], [x + w / 2, 132], [460, 132], [460, 107]], { dashed: true });
  });
  b += text(470, 126, "implements", { size: 10.5, anchor: "start", color: "#64748b" });
  return svg(900, 230, b, caption);
}

export function outbox() {
  let b = "";
  b += frame(15, 25, 420, 190, "ONE database transaction", "green");
  b += box(35, 50, 180, 50, "INSERT lead", [], { color: "blue", titleSize: 12.5 });
  b += box(235, 50, 180, 50, "INSERT activity + consent", [], { color: "blue", titleSize: 12 });
  b += box(35, 120, 380, 75, "INSERT automation_jobs", ["SEND_CONFIRMATION · NOTIFY_STAFF · SYNC_SHEET · AI_CLASSIFY", "idempotency_key unique → never queued twice"], { color: "amber", size: 10.5 });
  b += text(225, 240, "commit = all rows exist, or none do", { size: 11.5, weight: 600, color: "#047857" });
  b += box(520, 40, 170, 70, "Worker", ["reads PENDING jobs", "later (seconds)"], { color: "amber" });
  b += box(720, 40, 165, 70, "External services", ["email · Sheets", "WhatsApp · Claude"], { color: "cyan" });
  b += arrow(437, 150, 518, 85, { lbl: "poll", dy: -4 }) + arrow(690, 75, 718, 75);
  b += box(520, 145, 365, 75, "Why not call the email API inside the request?", ["If it is slow or down, the customer waits or the lead is lost.", "With the outbox, the lead is safe first; delivery is retried."], { color: "slate", dashed: true, size: 10.5, titleSize: 12 });
  return svg(900, 255, b, "Transactional outbox: saving the work to do in the same transaction as the data.");
}
