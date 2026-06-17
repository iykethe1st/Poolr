-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('PAYSTACK', 'WALLET');

-- AlterTable
ALTER TABLE "contributions" ADD COLUMN "payment_source" "PaymentSource" NOT NULL DEFAULT 'PAYSTACK';
