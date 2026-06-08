-- AlterTable
ALTER TABLE "kyc_profiles" ADD COLUMN     "kyc_attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT;
