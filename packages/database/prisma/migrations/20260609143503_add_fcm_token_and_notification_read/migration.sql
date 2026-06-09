-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcm_token" TEXT;
