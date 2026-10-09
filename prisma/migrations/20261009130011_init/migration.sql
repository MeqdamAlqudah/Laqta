-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'AGENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'DUPLICATE_MERGED', 'STATUS_CHANGED', 'OWNER_CHANGED', 'NOTE', 'CALL', 'MESSAGE', 'EMAIL_SENT', 'NOTIFICATION_SENT', 'SYNCED', 'AI_SUGGESTION', 'SLA_ESCALATED', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SEND_CONFIRMATION', 'NOTIFY_STAFF', 'NOTIFY_WHATSAPP', 'SYNC_SHEET', 'AI_CLASSIFY', 'SLA_ESCALATION', 'DAILY_SUMMARY');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'DEAD');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('EMAIL', 'SHEETS_WEBHOOK', 'WHATSAPP', 'AI');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Amman',
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "public_key" TEXT NOT NULL,
    "lead_counter" INTEGER NOT NULL DEFAULT 1000,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "routing_rule" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_e164" TEXT,
    "email" TEXT,
    "service_id" TEXT,
    "preferred_at" TIMESTAMP(3),
    "message" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "owner_id" TEXT,
    "source_channel" TEXT NOT NULL,
    "source_campaign" TEXT,
    "source_meta" JSONB NOT NULL DEFAULT '{}',
    "idempotency_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sla_due_at" TIMESTAMP(3),
    "sla_escalated_at" TIMESTAMP(3),
    "first_contacted_at" TIMESTAMP(3),
    "ai_category" TEXT,
    "ai_priority" TEXT,
    "ai_reason" TEXT,
    "ai_suggested_reply" TEXT,
    "ai_provider" TEXT,
    "anonymized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "actor_id" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "job_type" "JobType" NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "idempotency_key" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "encrypted_credentials" TEXT,
    "configuration_json" JSONB NOT NULL DEFAULT '{}',
    "last_success_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_id" TEXT,
    "type" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_public_key_key" ON "organizations"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_organization_id_code_key" ON "services"("organization_id", "code");

-- CreateIndex
CREATE INDEX "leads_organization_id_status_idx" ON "leads"("organization_id", "status");

-- CreateIndex
CREATE INDEX "leads_organization_id_owner_id_idx" ON "leads"("organization_id", "owner_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_created_at_idx" ON "leads"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_organization_id_phone_e164_idx" ON "leads"("organization_id", "phone_e164");

-- CreateIndex
CREATE INDEX "leads_organization_id_email_idx" ON "leads"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organization_id_idempotency_key_key" ON "leads"("organization_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organization_id_reference_key" ON "leads"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_jobs_idempotency_key_key" ON "automation_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "automation_jobs_state_next_attempt_at_idx" ON "automation_jobs"("state", "next_attempt_at");

-- CreateIndex
CREATE INDEX "automation_jobs_organization_id_state_idx" ON "automation_jobs"("organization_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_organization_id_provider_key" ON "integrations"("organization_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_signature_key" ON "webhook_events"("signature");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
