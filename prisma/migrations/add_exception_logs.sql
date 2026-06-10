-- Migration: add_exception_logs_table
-- Applies to: universal_admin DB
-- Purpose: Creates the exception_logs table for the universal log ingestion gateway.
-- Applied manually via: npx prisma db execute --file prisma/migrations/add_exception_logs.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Resolve pre-existing drift (manual schema changes not in migration history)
-- These changes were applied directly to the DB and must be reflected before
-- Prisma can track the new migration cleanly.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add POSTGRESQL to DbDriver enum if it doesn't already exist
DO $$ BEGIN
  ALTER TYPE "DbDriver" ADD VALUE IF NOT EXISTS 'POSTGRESQL';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add description column to product_registries if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_registries' AND column_name = 'description'
  ) THEN
    ALTER TABLE "product_registries" ADD COLUMN "description" TEXT;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Create the exception_logs table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "exception_logs" (
    "id"           TEXT NOT NULL,
    "product_id"   TEXT NOT NULL,
    "company_id"   TEXT NOT NULL,
    "user_id"      TEXT,
    "method"       TEXT,
    "path"         TEXT,
    "status_code"  INTEGER,
    "error_name"   TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "stack_trace"  TEXT,
    "platform"     TEXT,
    "environment"  TEXT,
    "ip_address"   TEXT,
    "user_agent"   TEXT,
    "request_body" JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_logs_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Create composite indexes for high-performance dashboard filtering
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "exception_logs_company_id_idx"
    ON "exception_logs"("company_id");

CREATE INDEX IF NOT EXISTS "exception_logs_product_id_idx"
    ON "exception_logs"("product_id");

CREATE INDEX IF NOT EXISTS "exception_logs_createdAt_idx"
    ON "exception_logs"("createdAt");

CREATE INDEX IF NOT EXISTS "exception_logs_company_id_product_id_idx"
    ON "exception_logs"("company_id", "product_id");

CREATE INDEX IF NOT EXISTS "exception_logs_company_id_createdAt_idx"
    ON "exception_logs"("company_id", "createdAt");

CREATE INDEX IF NOT EXISTS "exception_logs_product_id_createdAt_idx"
    ON "exception_logs"("product_id", "createdAt");
