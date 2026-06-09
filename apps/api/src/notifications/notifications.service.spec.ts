import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotifChannel, NotifStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../database/prisma.service';
import { PushService } from './push.service';
import { SmsService } from './sms.service';

const USER_ID = 'user-1';
const NOTIF_ID = 'notif-1';

const MOCK_NOTIFICATION = {
  id: NOTIF_ID,
  userId: USER_ID,
  title: 'Test',
  body: 'Test body',
  channel: NotifChannel.IN_APP,
  status: NotifStatus.SENT,
  isRead: false,
  readAt: null,
  sentAt: new Date(),
  createdAt: new Date(),
};

function makePrismaMock() {
  return {
    notification: {
      create: jest.fn().mockResolvedValue(MOCK_NOTIFICATION),
      findMany: jest.fn().mockResolvedValue([MOCK_NOTIFICATION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_NOTIFICATION),
      update: jest.fn().mockResolvedValue({ ...MOCK_NOTIFICATION, isRead: true, readAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      count: jest.fn().mockResolvedValue(1),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ fcmToken: 'tok', phone: '+2348012345678' }),
    },
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let push: { send: jest.Mock };
  let sms: { send: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    push = { send: jest.fn().mockResolvedValue(undefined) };
    sms = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
        { provide: SmsService, useValue: sms },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── persist ────────────────────────────────────────────────────────────────

  describe('persist', () => {
    it('creates notification record with SENT status', async () => {
      await service.persist(USER_ID, 'Title', 'Body', NotifChannel.IN_APP);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            title: 'Title',
            body: 'Body',
            channel: NotifChannel.IN_APP,
            status: NotifStatus.SENT,
          }),
        }),
      );
    });
  });

  // ── sendPush ───────────────────────────────────────────────────────────────

  describe('sendPush', () => {
    it('fetches FCM token and sends push notification', async () => {
      await service.sendPush(USER_ID, 'Title', 'Body');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: { fcmToken: true },
      });
      expect(push.send).toHaveBeenCalledWith('tok', 'Title', 'Body');
    });

    it('skips push when user has no FCM token', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ fcmToken: null });

      await service.sendPush(USER_ID, 'Title', 'Body');

      expect(push.send).not.toHaveBeenCalled();
    });
  });

  // ── sendSms ────────────────────────────────────────────────────────────────

  describe('sendSms', () => {
    it('fetches phone and sends SMS', async () => {
      await service.sendSms(USER_ID, 'Hello');

      expect(sms.send).toHaveBeenCalledWith('+2348012345678', 'Hello');
    });

    it('skips SMS when user has no phone', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ phone: null });

      await service.sendSms(USER_ID, 'Hello');

      expect(sms.send).not.toHaveBeenCalled();
    });
  });

  // ── listForUser ────────────────────────────────────────────────────────────

  describe('listForUser', () => {
    it('returns paginated notifications with metadata', async () => {
      prisma.notification.count
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(2); // unreadCount

      const result = await service.listForUser(USER_ID, { page: 1, limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID }, skip: 0, take: 20 }),
      );
      expect(result).toMatchObject({ total: 5, page: 1, limit: 20, totalPages: 1, unreadCount: 2 });
    });
  });

  // ── markRead ───────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('marks notification as read and sets readAt', async () => {
      const result = await service.markRead(NOTIF_ID, USER_ID);

      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: NOTIF_ID },
          data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
        }),
      );
      expect(result).toEqual({ message: 'Marked as read' });
    });

    it('returns early without update if already read', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce({ ...MOCK_NOTIFICATION, isRead: true });

      const result = await service.markRead(NOTIF_ID, USER_ID);

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Already marked as read' });
    });

    it('throws NotFoundException when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce(null);

      await expect(service.markRead(NOTIF_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce({
        ...MOCK_NOTIFICATION,
        userId: 'other-user',
      });

      await expect(service.markRead(NOTIF_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── markAllRead ────────────────────────────────────────────────────────────

  describe('markAllRead', () => {
    it('bulk-updates all unread notifications for the user', async () => {
      prisma.notification.updateMany.mockResolvedValueOnce({ count: 5 });

      const result = await service.markAllRead(USER_ID);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, isRead: false },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
      expect(result).toEqual({ updated: 5 });
    });
  });
});
