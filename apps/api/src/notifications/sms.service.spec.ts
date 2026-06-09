import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

function makeConfigMock(apiKey?: string) {
  return {
    get: (key: string, fallback?: string) => {
      if (key === 'TERMII_API_KEY') return apiKey;
      if (key === 'TERMII_SENDER_ID') return fallback ?? 'Poolr';
      return fallback;
    },
  };
}

describe('SmsService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  async function buildService(apiKey?: string): Promise<SmsService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: ConfigService, useValue: makeConfigMock(apiKey) },
      ],
    }).compile();
    return module.get(SmsService);
  }

  it('POSTs to Termii API with correct payload when API key is set', async () => {
    const svc = await buildService('termii-key-123');
    await svc.send('+2348012345678', 'Hello from Poolr');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('termii.com'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('+2348012345678'),
      }),
    );

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      to: '+2348012345678',
      sms: 'Hello from Poolr',
      api_key: 'termii-key-123',
    });
  });

  it('silently skips fetch when TERMII_API_KEY is not set (dev mode)', async () => {
    const svc = await buildService(undefined);
    await expect(svc.send('+2348012345678', 'test')).resolves.not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws when Termii returns a non-OK response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    } as Response);

    const svc = await buildService('termii-key-123');
    await expect(svc.send('+2348012345678', 'test')).rejects.toThrow('SMS delivery failed: 400');
  });
});
