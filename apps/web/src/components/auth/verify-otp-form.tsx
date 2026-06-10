'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HTTPError } from 'ky';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from './otp-input';
import { authClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import type { ApiResponse } from '@poolr/types';

const RESEND_COOLDOWN = 30;

export function VerifyOtpForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('poolr_verify_phone') ?? '';
    setPhone(stored);
    if (!stored) router.replace('/register');
  }, [router]);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) {
      setError('Enter all 6 digits.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const data = await authClient
        .post('auth/verify-otp', { json: { phone, otp } })
        .json<ApiResponse<{ accessToken: string }>>();

      if (data.data?.accessToken) {
        setToken(data.data.accessToken);
        sessionStorage.removeItem('poolr_verify_phone');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<ApiResponse>();
        setError(body.message ?? 'Verification failed. Please try again.');
      } else {
        setError('Network error. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError('');
    setSuccess('');
    setResending(true);
    try {
      await authClient.post('auth/resend-otp', { json: { phone } }).json();
      setSuccess('A new code has been sent to your phone.');
      startCountdown();
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<ApiResponse>();
        setError(body.message ?? 'Could not resend code. Try again.');
      } else {
        setError('Network error. Check your connection and try again.');
      }
    } finally {
      setResending(false);
    }
  }

  const maskedPhone = phone
    ? phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4)
    : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-center text-sm text-muted-foreground">
        Enter the 6-digit code sent to{' '}
        <span className="font-medium text-foreground">{maskedPhone}</span>
      </p>

      <OtpInput value={otp} onChange={setOtp} disabled={submitting} />

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
          {success}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting || otp.length < 6}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Verify phone number
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        Didn&apos;t receive a code?{' '}
        {countdown > 0 ? (
          <span>Resend in {countdown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Wrong number?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Go back
        </Link>
      </p>
    </form>
  );
}
