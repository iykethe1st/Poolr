-- Migration: payout_held_and_group_terms
-- Adds payout hold columns to cycles and group terms acceptance timestamp to group_members.
-- These were missing from the 20260701000000 migration which was already applied.

ALTER TABLE "cycles" ADD COLUMN IF NOT EXISTS "payout_held" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cycles" ADD COLUMN IF NOT EXISTS "payout_held_reason" TEXT;

ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "group_terms_accepted_at" TIMESTAMP(3);
