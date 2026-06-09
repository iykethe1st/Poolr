import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      try {
        this.app = admin.initializeApp(
          {
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
          },
          'poolr-push',
        );
        this.logger.log('Firebase Admin SDK initialized');
      } catch (err) {
        this.logger.error(`Firebase init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('FIREBASE_* credentials not set — push notifications disabled');
    }
  }

  async send(fcmToken: string, title: string, body: string): Promise<void> {
    if (!this.app) {
      this.logger.debug(`[DEV] Push skipped — title: "${title}"`);
      return;
    }

    try {
      const messageId = await admin.messaging(this.app).send({
        token: fcmToken,
        notification: { title, body },
      });
      this.logger.debug(`Push sent: ${messageId}`);
    } catch (err) {
      // FCM errors are non-fatal — log and continue
      this.logger.error(`FCM send failed for token ${fcmToken.slice(0, 10)}…: ${(err as Error).message}`);
    }
  }
}
