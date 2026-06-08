import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaystackService } from './paystack.service';

function makeConfigMock(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    PAYSTACK_BASE_URL: 'https://api.paystack.co',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def?: string) => values[key] ?? def ?? ''),
  };
}

describe('PaystackService', () => {
  let service: PaystackService;
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
    jest.clearAllMocks();
  });

  function buildService(configValues?: Record<string, string>) {
    const module = Test.createTestingModule({
      providers: [
        PaystackService,
        { provide: ConfigService, useValue: makeConfigMock(configValues) },
      ],
    });
    return module.compile().then((m) => m.get(PaystackService));
  }

  // ── Dev mode (no secret key) ─────────────────────────────────────────────

  describe('initializeTransaction — dev mode', () => {
    it('returns mock authorization URL without calling Paystack', async () => {
      service = await buildService();

      const result = await service.initializeTransaction({
        email: 'user@example.com',
        amountNgn: 5000,
        reference: 'contrib_test_123',
      });

      expect(result.authorizationUrl).toContain('dev_mock');
      expect(result.reference).toBe('contrib_test_123');
    });
  });

  describe('verifyTransaction — dev mode', () => {
    it('returns success without calling Paystack', async () => {
      service = await buildService();

      const result = await service.verifyTransaction('contrib_test_123');

      expect(result.status).toBe('success');
      expect(result.reference).toBe('contrib_test_123');
    });
  });

  describe('initiateTransfer — dev mode', () => {
    it('returns mock transfer code without calling Paystack', async () => {
      service = await buildService();

      const result = await service.initiateTransfer({
        amountNgn: 25000,
        recipientCode: 'RCP_test',
        reference: 'payout_test_123',
      });

      expect(result.transferCode).toMatch(/^TRF_mock_/);
      expect(result.reference).toBe('payout_test_123');
    });
  });

  // ── Prod mode (with secret key) ──────────────────────────────────────────

  describe('initializeTransaction — prod mode', () => {
    it('POSTs to /transaction/initialize and returns URL', async () => {
      service = await buildService({ PAYSTACK_SECRET_KEY: 'sk_live_test' });

      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/xxx',
            reference: 'contrib_test',
          },
        }),
      } as Response);

      const result = await service.initializeTransaction({
        email: 'user@example.com',
        amountNgn: 5000,
        reference: 'contrib_test',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/initialize',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.authorizationUrl).toBe('https://checkout.paystack.com/xxx');
    });

    it('throws on Paystack API error', async () => {
      service = await buildService({ PAYSTACK_SECRET_KEY: 'sk_live_test' });

      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ status: false, message: 'Invalid key' }),
      } as Response);

      await expect(
        service.initializeTransaction({ email: 'u@x.com', amountNgn: 100, reference: 'ref' }),
      ).rejects.toThrow('Paystack error');
    });
  });

  describe('verifyTransaction — prod mode', () => {
    it('GETs /transaction/verify/:reference', async () => {
      service = await buildService({ PAYSTACK_SECRET_KEY: 'sk_live_test' });

      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          data: { status: 'success', amount: 500000, reference: 'ref_abc' },
        }),
      } as Response);

      const result = await service.verifyTransaction('ref_abc');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/verify/ref_abc',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.status).toBe('success');
      expect(result.amountKobo).toBe(500000);
    });
  });

  describe('initiateTransfer — prod mode', () => {
    it('POSTs to /transfer', async () => {
      service = await buildService({ PAYSTACK_SECRET_KEY: 'sk_live_test' });

      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          data: { transfer_code: 'TRF_real_123', reference: 'payout_ref' },
        }),
      } as Response);

      const result = await service.initiateTransfer({
        amountNgn: 25000,
        recipientCode: 'RCP_real',
        reference: 'payout_ref',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.transferCode).toBe('TRF_real_123');
    });
  });
});
