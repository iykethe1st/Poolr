import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean in reverse dependency order for idempotent runs
  await prisma.notification.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.cycle.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.kycProfile.deleteMany();
  await prisma.user.deleteMany();

  const alice = await prisma.user.create({
    data: {
      fullName: 'Alice Okafor',
      email: 'alice@poolr.dev',
      phone: '+2348012345678',
      passwordHash: '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FApkc4f8DtJ7bW6eFqz3a2placeholder',
      role: 'USER',
      status: 'ACTIVE',
      kycProfile: {
        create: {
          bvn: '12345678901',
          kycStatus: 'VERIFIED',
          verifiedAt: new Date('2026-01-15'),
        },
      },
      wallet: {
        create: { balance: 50000, currency: 'NGN' },
      },
    },
  });

  const bob = await prisma.user.create({
    data: {
      fullName: 'Bob Adeyemi',
      email: 'bob@poolr.dev',
      phone: '+2348098765432',
      passwordHash: '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FApkc4f8DtJ7bW6eFqz3a2placeholder',
      role: 'USER',
      status: 'ACTIVE',
      kycProfile: {
        create: { kycStatus: 'PENDING' },
      },
      wallet: {
        create: { balance: 25000, currency: 'NGN' },
      },
    },
  });

  const group = await prisma.group.create({
    data: {
      adminId: alice.id,
      name: 'Lagos Tech Ajo',
      contributionAmount: 10000,
      currency: 'NGN',
      frequency: 'MONTHLY',
      maxMembers: 10,
      status: 'ACTIVE',
      startDate: new Date('2026-07-01'),
    },
  });

  const aliceMember = await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: alice.id,
      rotationPosition: 1,
      memberStatus: 'ACTIVE',
    },
  });

  const bobMember = await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: bob.id,
      rotationPosition: 2,
      memberStatus: 'ACTIVE',
    },
  });

  const cycle1 = await prisma.cycle.create({
    data: {
      groupId: group.id,
      recipientId: alice.id,
      cycleNumber: 1,
      dueDate: new Date('2026-07-31'),
      status: 'ACTIVE',
    },
  });

  await prisma.contribution.createMany({
    data: [
      {
        cycleId: cycle1.id,
        memberId: aliceMember.id,
        amount: 10000,
        status: 'PAID',
        paystackRef: 'PSK_TEST_ALICE_C1',
        paidAt: new Date('2026-07-10'),
        dueAt: new Date('2026-07-25'),
      },
      {
        cycleId: cycle1.id,
        memberId: bobMember.id,
        amount: 10000,
        status: 'PENDING',
        dueAt: new Date('2026-07-25'),
      },
    ],
  });

  const aliceWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: alice.id } });
  await prisma.walletTransaction.create({
    data: {
      walletId: aliceWallet.id,
      amount: 50000,
      type: 'TOPUP',
      direction: 'CREDIT',
      reference: 'TXN_TOPUP_ALICE_001',
    },
  });

  console.log('Seeded:', {
    users: [alice.email, bob.email],
    group: group.name,
    cycle: cycle1.cycleNumber,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
