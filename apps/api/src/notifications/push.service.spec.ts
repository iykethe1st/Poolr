import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushService } from './push.service';

// Mock firebase-admin before any imports
jest.mock('firebase-admin', () => {
  const sendMock = jest.fn().mockResolvedValue('projects/test/messages/123');
  return {
    initializeApp: jest.fn().mockReturnValue({}),
    credential: {
      cert: jest.fn().mockReturnValue({}),
    },
    messaging: jest.fn().mockReturnValue({ send: sendMock }),
    _sendMock: sendMock,
  };
});

import * as admin from 'firebase-admin';

function makeConfigMock(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

const FULL_CREDS = {
  FIREBASE_PROJECT_ID: 'poolr-test',
  FIREBASE_CLIENT_EMAIL: 'test@poolr-test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----',
};

describe('PushService', () => {
  afterEach(() => jest.clearAllMocks());

  async function buildService(configValues: Record<string, string | undefined>): Promise<PushService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: ConfigService, useValue: makeConfigMock(configValues) },
      ],
    }).compile();
    const svc = module.get(PushService);
    svc.onModuleInit();
    return svc;
  }

  it('initializes Firebase app when all credentials are provided', async () => {
    await buildService(FULL_CREDS);
    expect(admin.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ credential: expect.anything() }),
      'poolr-push',
    );
  });

  it('does NOT initialize Firebase when credentials are missing', async () => {
    (admin.initializeApp as jest.Mock).mockClear();
    await buildService({});
    expect(admin.initializeApp).not.toHaveBeenCalled();
  });

  it('sends a push notification when app is initialized', async () => {
    const svc = await buildService(FULL_CREDS);
    await svc.send('device-token-abc', 'Hello', 'World');
    const { _sendMock } = admin as unknown as { _sendMock: jest.Mock };
    expect(_sendMock).toHaveBeenCalledWith({
      token: 'device-token-abc',
      notification: { title: 'Hello', body: 'World' },
    });
  });

  it('silently skips when no app (dev mode — no credentials)', async () => {
    (admin.initializeApp as jest.Mock).mockClear();
    const svc = await buildService({});
    await expect(svc.send('token', 'T', 'B')).resolves.not.toThrow();
    const { _sendMock } = admin as unknown as { _sendMock: jest.Mock };
    expect(_sendMock).not.toHaveBeenCalled();
  });

  it('logs error and does NOT throw when FCM returns an error', async () => {
    const svc = await buildService(FULL_CREDS);
    const { _sendMock } = admin as unknown as { _sendMock: jest.Mock };
    _sendMock.mockRejectedValueOnce(new Error('registration-token-not-registered'));
    await expect(svc.send('bad-token', 'T', 'B')).resolves.not.toThrow();
  });
});
