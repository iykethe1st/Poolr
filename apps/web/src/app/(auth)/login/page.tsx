import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-muted-foreground">Sign in to your Poolr account</p>
      {/* Suspense needed because LoginForm calls useSearchParams() */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
