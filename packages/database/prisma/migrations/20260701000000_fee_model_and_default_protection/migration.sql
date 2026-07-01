-- Migration: fee_model_and_default_protection
-- Adds platform fee columns, ContributionFee table, soft-delete for groups,
-- and Default Protection System tables (FlaggedIdentity, Debt, BanRecord).

-- ── 1. Add fee columns to contributions ──────────────────────────────────────
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "fee_amount" DECIMAL(12,2);
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "total_charged" DECIMAL(12,2);

-- ── 2. Add soft-delete to groups ─────────────────────────────────────────────
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- ── 3. ContributionFee table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contribution_fees" (
  "id"                  TEXT NOT NULL,
  "contribution_id"     TEXT NOT NULL,
  "user_id"             TEXT NOT NULL,
  "contribution_amount" DECIMAL(12,2) NOT NULL,
  "fee_amount"          DECIMAL(12,2) NOT NULL,
  "reserve_amount"      DECIMAL(12,2) NOT NULL,
  "revenue_amount"      DECIMAL(12,2) NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contribution_fees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contribution_fees_contribution_id_key"
  ON "contribution_fees"("contribution_id");

ALTER TABLE "contribution_fees"
  ADD CONSTRAINT "contribution_fees_contribution_id_fkey"
    FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contribution_fees"
  ADD CONSTRAINT "contribution_fees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. DebtStatus enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DebtStatus" AS ENUM ('OUTSTANDING', 'PARTIAL', 'CLEARED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── 5. BanReason enum ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "BanReason" AS ENUM (
    'RECEIVED_PAYOUT_THEN_DEFAULTED',
    'MANUAL_ADMIN_BAN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── 6. FlaggedIdentity table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "flagged_identities" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "bvn_hash"       TEXT,
  "nin_hash"       TEXT,
  "flagged_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "flagged_reason" TEXT NOT NULL,

  CONSTRAINT "flagged_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "flagged_identities_user_id_key"
  ON "flagged_identities"("user_id");

ALTER TABLE "flagged_identities"
  ADD CONSTRAINT "flagged_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 7. Debt table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "debts" (
  "id"           TEXT NOT NULL,
  "user_id"      TEXT NOT NULL,
  "cycle_id"     TEXT NOT NULL,
  "amount_ngn"   DECIMAL(12,2) NOT NULL,
  "status"       "DebtStatus" NOT NULL DEFAULT 'OUTSTANDING',
  "payment_link" TEXT,
  "payment_ref"  TEXT,
  "cleared_at"   TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "debts_payment_ref_key"
  ON "debts"("payment_ref");

ALTER TABLE "debts"
  ADD CONSTRAINT "debts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "debts"
  ADD CONSTRAINT "debts_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 8. BanRecord table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ban_records" (
  "id"                TEXT NOT NULL,
  "user_id"           TEXT NOT NULL,
  "reason"            "BanReason" NOT NULL,
  "banned_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "banned_by_admin_id" TEXT,
  "notes"             TEXT,

  CONSTRAINT "ban_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ban_records"
  ADD CONSTRAINT "ban_records_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
