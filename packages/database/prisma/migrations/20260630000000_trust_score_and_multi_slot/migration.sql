-- Migration: trust_score_and_multi_slot
-- Adds Trust Score system and multi-slot GroupMember support

-- ── 1. Add trustScore to users ──────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trust_score" INTEGER NOT NULL DEFAULT 50;

-- ── 2. Add minTrustScore to groups ──────────────────────────────────────────
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "min_trust_score" INTEGER;

-- ── 3. Add slotNumber to group_members (backfill = 1 for all existing rows) ─
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "slot_number" INTEGER NOT NULL DEFAULT 1;

-- ── 4. Drop old unique constraint (groupId, userId) ─────────────────────────
ALTER TABLE "group_members" DROP CONSTRAINT IF EXISTS "group_members_group_id_user_id_key";

-- ── 5. Add new unique constraint (userId, groupId, slotNumber) ──────────────
ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_user_id_group_id_slot_number_key"
  UNIQUE ("user_id", "group_id", "slot_number");

-- ── 6. TrustScoreEventType enum ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "TrustScoreEventType" AS ENUM (
    'ON_TIME_CONTRIBUTION',
    'CYCLE_COMPLETED',
    'CYCLE_COMPLETED_NO_MISSES_BONUS',
    'LATE_CONTRIBUTION',
    'ACCOUNT_FROZEN',
    'ACCOUNT_BANNED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── 7. TrustScoreEvent table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "trust_score_events" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "user_id"         TEXT NOT NULL,
  "event_type"      "TrustScoreEventType" NOT NULL,
  "points_delta"    INTEGER NOT NULL,
  "score_before"    INTEGER NOT NULL,
  "score_after"     INTEGER NOT NULL,
  "reason"          TEXT NOT NULL,
  "group_id"        TEXT,
  "contribution_id" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trust_score_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index for efficient per-user queries
CREATE INDEX IF NOT EXISTS "trust_score_events_user_id_idx"
  ON "trust_score_events"("user_id");
