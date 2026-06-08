export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';
export {
  Role,
  UserStatus,
  KycStatus,
  GroupStatus,
  Frequency,
  Currency,
  MemberStatus,
  CycleStatus,
  ContribStatus,
  PayoutStatus,
  PenaltyStatus,
  PenaltyReason,
  TxDirection,
  TxType,
  NotifChannel,
  NotifStatus,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
