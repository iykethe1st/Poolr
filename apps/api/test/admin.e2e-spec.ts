import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { Role } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TermiiService } from '../src/auth/termii.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOMAIN = '@poolr-admin-e2e.test';
let _userSeq = 0;

function makeInMemoryRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.expiresAt) { store.delete(key); return null; }
      return entry.value;
    }),
    set: jest.fn(async (key: string, value: string, ttlSeconds?: number) => {
      store.set(key, { value, expiresAt: Date.now() + (ttlSeconds ? ttlSeconds * 1000 : 365 * 24 * 3600 * 1000) });
    }),
    del: jest.fn(async (key: string) => { store.delete(key); }),
    _store: store,
  };
}

function makeQueueMock() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    // BullExplorer reads opts.connection from the queue ref to configure Workers.
    // Without it, the Worker constructor throws "Worker requires a connection".
    opts: { connection: { host: 'localhost', port: 6379 } },
  };
}

async function registerAndLogin(
  app: INestApplication,
  userData: { fullName: string; email: string; phone: string; password: string },
  capturedOtp: () => string,
): Promise<string> {
  const regRes = await supertest(app.getHttpServer()).post('/api/auth/register').send(userData);
  if (regRes.status !== 201) throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);

  const verRes = await supertest(app.getHttpServer())
    .post('/api/auth/verify-otp')
    .send({ phone: userData.phone, otp: capturedOtp() });
  if (verRes.status !== 200) throw new Error(`Verify OTP failed (${verRes.status}): ${JSON.stringify(verRes.body)}`);

  return (verRes.body as { accessToken: string }).accessToken;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

jest.setTimeout(60_000);

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeRedis: ReturnType<typeof makeInMemoryRedis>;
  let payoutQueueMock: ReturnType<typeof makeQueueMock>;
  let otpCapture = '';

  // Tokens populated in beforeAll
  let userToken: string;      // regular USER
  let adminToken: string;     // ADMIN
  let superAdminToken: string; // SUPER_ADMIN

  // IDs for test data
  let testGroupId: string;
  let testCycleId: string;
  let testPenaltyId: string;

  const userCreds = () => ({
    fullName: 'Regular User',
    email: `user-${++_userSeq}-${Date.now()}${DOMAIN}`,
    phone: `+23480${Math.floor(10000000 + Math.random() * 89999999)}`,
    password: 'SecurePass1!',
  });

  beforeAll(async () => {
    fakeRedis = makeInMemoryRedis();
    payoutQueueMock = makeQueueMock();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue(fakeRedis)
      .overrideProvider(TermiiService).useValue({
        sendOtp: jest.fn(async (_phone: string, otp: string) => { otpCapture = otp; }),
      })
      .overrideProvider(getQueueToken('payout')).useValue(payoutQueueMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: [{ path: 'health', method: 4 }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = moduleRef.get(PrismaService);

    // ── Create regular user ──────────────────────────────────────────────────
    const regularUser = userCreds();
    userToken = await registerAndLogin(app, regularUser, () => otpCapture);

    // ── Create and promote admin user ─────────────────────────────────────
    const adminUser = { ...userCreds(), fullName: 'Admin User' };
    fakeRedis._store.clear();
    await registerAndLogin(app, adminUser, () => otpCapture);
    await prisma.user.update({ where: { email: adminUser.email }, data: { role: Role.ADMIN } });
    const adminLogin = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    // ── Create and promote super-admin ────────────────────────────────────
    const superAdmin = { ...userCreds(), fullName: 'Super Admin' };
    fakeRedis._store.clear();
    await registerAndLogin(app, superAdmin, () => otpCapture);
    await prisma.user.update({ where: { email: superAdmin.email }, data: { role: Role.SUPER_ADMIN } });
    const saLogin = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = (saLogin.body as { accessToken: string }).accessToken;

    // ── Seed a group, cycle, and penalty for data-shape tests ────────────────
    const adminDbUser = await prisma.user.findUnique({ where: { email: adminUser.email } });

    const group = await prisma.group.create({
      data: {
        adminId: adminDbUser!.id,
        name: 'E2E Test Pool',
        contributionAmount: 5000,
        frequency: 'MONTHLY',
        maxMembers: 5,
        status: 'ACTIVE',
      },
    });
    testGroupId = group.id;

    const cycle = await prisma.cycle.create({
      data: {
        groupId: group.id,
        recipientId: adminDbUser!.id,
        cycleNumber: 1,
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        status: 'PENDING',
      },
    });
    testCycleId = cycle.id;

    const member = await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: adminDbUser!.id,
        rotationPosition: 1,
        memberStatus: 'ACTIVE',
      },
    });

    const contrib = await prisma.contribution.create({
      data: {
        cycleId: cycle.id,
        memberId: member.id,
        amount: 5000,
        status: 'PAID',
        dueAt: cycle.dueDate,
        paidAt: new Date(),
      },
    });

    const penalty = await prisma.penalty.create({
      data: {
        contributionId: contrib.id,
        memberId: member.id,
        penaltyAmount: 250,
        reason: 'MISSED_PAYMENT',
        status: 'APPLIED',
        appliedAt: new Date(),
      },
    });
    testPenaltyId = penalty.id;
  });

  afterAll(async () => {
    if (prisma) {
      // Gather all test users (including leftovers from prior failed runs)
      const testUsers = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } } });
      const userIds = testUsers.map((u) => u.id);

      if (userIds.length > 0) {
        // Find every group these users admin
        const testGroups = await prisma.group.findMany({ where: { adminId: { in: userIds } } });
        const groupIds = testGroups.map((g) => g.id);

        if (groupIds.length > 0) {
          // Delete in reverse FK dependency order
          await prisma.penalty.deleteMany({ where: { member: { groupId: { in: groupIds } } } });
          await prisma.contribution.deleteMany({ where: { cycle: { groupId: { in: groupIds } } } });
          await prisma.payout.deleteMany({ where: { cycle: { groupId: { in: groupIds } } } });
          await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
          await prisma.cycle.deleteMany({ where: { groupId: { in: groupIds } } });
          await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
        }

        await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
      }
    }
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 401 / 403 enforcement ─────────────────────────────────────────────────

  describe('access control', () => {
    const adminRoutes = [
      { method: 'get', path: '/api/admin/groups' },
      { method: 'get', path: '/api/admin/penalties' },
    ];

    it.each(adminRoutes)(
      '401 → $method $path without token',
      async ({ method, path }) => {
        const res = await (supertest(app.getHttpServer()) as unknown as Record<string, (p: string) => supertest.Test>)[method](path);
        expect(res.status).toBe(401);
      },
    );

    it.each(adminRoutes)(
      '403 → $method $path with regular user token',
      async ({ method, path }) => {
        const res = await (supertest(app.getHttpServer()) as unknown as Record<string, (p: string) => supertest.Test>)[method](path)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(403);
      },
    );

    it('403 → GET /api/admin/users with ADMIN (not SUPER_ADMIN) token', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('200 → GET /api/admin/groups with ADMIN token', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/groups')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('200 → GET /api/admin/users with SUPER_ADMIN token', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/groups ─────────────────────────────────────────────────────

  describe('GET /api/admin/groups', () => {
    it('returns array with stats shape', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const group = (res.body as Array<Record<string, unknown>>).find((g) => g['id'] === testGroupId);
      expect(group).toBeDefined();
      expect(group!['stats']).toMatchObject({
        totalMembers: expect.any(Number),
        totalCycles: expect.any(Number),
        totalCollectedNgn: expect.any(Number),
      });
    });
  });

  // ── GET /admin/groups/:id/cycles ──────────────────────────────────────────

  describe('GET /api/admin/groups/:id/cycles', () => {
    it('returns cycle summary with paid/pending/overdue/waived counts', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/admin/groups/${testGroupId}/cycles`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const cycle = (res.body as Array<Record<string, unknown>>).find((c) => c['id'] === testCycleId);
      expect(cycle).toBeDefined();
      expect(cycle!['summary']).toMatchObject({
        paid: expect.any(Number),
        pending: expect.any(Number),
        overdue: expect.any(Number),
        waived: expect.any(Number),
        total: expect.any(Number),
      });
      expect(Array.isArray(cycle!['contributions'])).toBe(true);
      // Our seeded contribution is PAID
      const contrib = (cycle!['contributions'] as Array<Record<string, unknown>>)[0];
      expect(contrib['status']).toBe('PAID');
      expect(contrib['memberName']).toBeDefined();
    });

    it('404 → unknown group', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/groups/nonexistent-group-id/cycles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /admin/groups/:id/members ─────────────────────────────────────────

  describe('GET /api/admin/groups/:id/members', () => {
    it('returns members with user, KYC, and contribution info', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/admin/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const member = (res.body as Array<Record<string, unknown>>)[0];
      expect(member).toHaveProperty('user');
      expect(member).toHaveProperty('contributions');
      expect(member).toHaveProperty('penalties');
      const user = member['user'] as Record<string, unknown>;
      expect(user).toHaveProperty('fullName');
      expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('passwordHash');
    });
  });

  // ── POST /admin/groups/:id/cycles/:cycleId/trigger-payout ─────────────────

  describe('POST /api/admin/groups/:id/cycles/:cycleId/trigger-payout', () => {
    it('202 → enqueues a payout job and returns jobId', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/admin/groups/${testGroupId}/cycles/${testCycleId}/trigger-payout`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('jobId');
      expect(payoutQueueMock.add).toHaveBeenCalledWith(
        'disburse',
        expect.objectContaining({ cycleId: testCycleId, groupId: testGroupId }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('404 → cycle not found in this group', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/admin/groups/${testGroupId}/cycles/nonexistent/trigger-payout`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('409 → payout already initiated', async () => {
      // Seed an INITIATED payout for this cycle
      await prisma.payout.create({
        data: {
          cycleId: testCycleId,
          recipientId: (await prisma.cycle.findUnique({ where: { id: testCycleId } }))!.recipientId,
          amount: 5000,
          status: 'INITIATED',
          initiatedAt: new Date(),
        },
      });

      const res = await supertest(app.getHttpServer())
        .post(`/api/admin/groups/${testGroupId}/cycles/${testCycleId}/trigger-payout`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);

      // Clean up
      await prisma.payout.deleteMany({ where: { cycleId: testCycleId } });
    });
  });

  // ── GET /admin/penalties ──────────────────────────────────────────────────

  describe('GET /api/admin/penalties', () => {
    it('returns applied penalties with member and contribution info', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/penalties')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const penalty = (res.body as Array<Record<string, unknown>>).find((p) => p['id'] === testPenaltyId);
      expect(penalty).toBeDefined();
      expect(penalty!['member']).toHaveProperty('user');
      expect(penalty!['contribution']).toBeDefined();
    });
  });

  // ── POST /admin/penalties/:id/waive ───────────────────────────────────────

  describe('POST /api/admin/penalties/:id/waive', () => {
    it('200 → waives the penalty without requiring group-admin check', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/admin/penalties/${testPenaltyId}/waive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Admin override for e2e test' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');

      const updated = await prisma.penalty.findUnique({ where: { id: testPenaltyId } });
      expect(updated!.status).toBe('WAIVED');
    });

    it('409 → already waived penalty', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/api/admin/penalties/${testPenaltyId}/waive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Double waive' });
      expect(res.status).toBe(409);
    });

    it('404 → unknown penalty', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/admin/penalties/nonexistent/waive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Does not exist' });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /admin/users ──────────────────────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('returns user list with KYC info and active group count', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const user = (res.body as Array<Record<string, unknown>>)[0];
      expect(user).toHaveProperty('fullName');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('status');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).toHaveProperty('_count');
    });
  });
});
