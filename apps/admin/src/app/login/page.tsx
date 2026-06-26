import type { Metadata } from 'next';
import { Suspense } from 'react';
import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Image src="/favicon.png" alt="Poolr" width={36} height={36} />
            <h1 className="text-2xl font-bold tracking-tight">Poolr Admin</h1>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to access the admin console</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
