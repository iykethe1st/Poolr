import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotifChannel, NotifStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PushService } from './push.service';
import { SmsService } from './sms.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly sms: SmsService,
  ) {}

  async persist(
    userId: string,
    title: string,
    body: string,
    channel: NotifChannel,
  ) {
    return this.prisma.notification.create({
      data: { userId, title, body, channel, status: NotifStatus.SENT, sentAt: new Date() },
    });
  }

  async sendPush(userId: string, title: string, body: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (user?.fcmToken) {
      await this.push.send(user.fcmToken, title, body);
    }
  }

  async sendSms(userId: string, message: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (user?.phone) {
      await this.sms.send(user.phone, message);
    }
  }

  async listForUser(userId: string, dto: ListNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount: await this.prisma.notification.count({ where: { userId, isRead: false } }),
    };
  }

  async markRead(notificationId: string, userId: string): Promise<{ message: string }> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Not your notification');
    if (notification.isRead) return { message: 'Already marked as read' };

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: count };
  }
}
