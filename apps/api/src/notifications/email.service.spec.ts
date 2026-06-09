import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// Mock Resend SDK
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null }) },
  })),
}));

// Mock @poolr/email render functions
jest.mock('@poolr/email', () => ({
  renderWelcomeEmail: jest.fn().mockResolvedValue('<html>welcome</html>'),
  renderKycResultEmail: jest.fn().mockResolvedValue('<html>kyc</html>'),
  renderGroupInvitationEmail: jest.fn().mockResolvedValue('<html>invite</html>'),
  renderPayoutReceivedEmail: jest.fn().mockResolvedValue('<html>payout</html>'),
  renderPayoutFailedEmail: jest.fn().mockResolvedValue('<html>failed</html>'),
}));

import { Resend } from 'resend';

function makeConfigMock(apiKey?: string) {
  return {
    get: (key: string, fallback?: string) => {
      if (key === 'RESEND_API_KEY') return apiKey;
      if (key === 'RESEND_FROM_EMAIL') return fallback ?? 'noreply@poolr.app';
      return fallback;
    },
  };
}

describe('EmailService', () => {
  let service: EmailService;
  let sendMock: jest.Mock;

  afterEach(() => jest.clearAllMocks());

  async function buildService(apiKey?: string): Promise<EmailService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: makeConfigMock(apiKey) },
      ],
    }).compile();
    return module.get(EmailService);
  }

  beforeEach(async () => {
    service = await buildService('re_test_key');
    const ResendClass = Resend as jest.MockedClass<typeof Resend>;
    const resendInstance = ResendClass.mock.results[0].value as { emails: { send: jest.Mock } };
    sendMock = resendInstance.emails.send;
  });

  it('calls Resend with correct from/to/subject on sendWelcome', async () => {
    await service.sendWelcome('ada@test.com', 'Ada Lovelace');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@test.com',
        subject: 'Welcome to Poolr!',
        html: '<html>welcome</html>',
      }),
    );
  });

  it('sends KYC approved email with correct subject', async () => {
    await service.sendKycApproved('ada@test.com', 'Ada');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Approved') }),
    );
  });

  it('sends KYC rejected email with action-required subject', async () => {
    await service.sendKycRejected('ada@test.com', 'Ada');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Action Required') }),
    );
  });

  it('sends group invitation email with invite token in subject', async () => {
    await service.sendGroupInvitation('ada@test.com', 'Ada', 'Admin', 'Test Pool', 'token-abc');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Test Pool') }),
    );
  });

  it('sends payout received email with group name in subject', async () => {
    await service.sendPayoutReceived('ada@test.com', 'Ada', 50_000, 'Test Pool');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Test Pool') }),
    );
  });

  it('sends payout failed email with action-required subject', async () => {
    await service.sendPayoutFailed('ada@test.com', 'Ada', 'Test Pool', 3, 'Timeout');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Action Required') }),
    );
  });

  it('silently skips sending when RESEND_API_KEY is not set (dev mode)', async () => {
    const devService = await buildService(undefined);
    const ResendClass = Resend as jest.MockedClass<typeof Resend>;
    const instanceCount = ResendClass.mock.instances.length;

    await expect(devService.sendWelcome('a@b.com', 'Dev')).resolves.not.toThrow();
    // No new Resend instance was created
    expect(ResendClass.mock.instances.length).toBe(instanceCount);
  });

  it('throws when Resend returns an error', async () => {
    sendMock.mockResolvedValueOnce({ error: { message: 'Domain not verified' } });
    await expect(service.sendWelcome('a@b.com', 'User')).rejects.toThrow('Domain not verified');
  });
});
