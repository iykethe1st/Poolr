import type { Metadata } from 'next';
import { VerifyOtpForm } from '@/components/auth/verify-otp-form';

export const metadata: Metadata = { title: 'Verify phone number' };

export default function VerifyOtpPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Verify your number</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        We sent a 6-digit code to your phone
      </p>
      <VerifyOtpForm />
    </div>
  );
}
