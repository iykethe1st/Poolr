import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Create an account</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Join Poolr and start saving together
      </p>
      <RegisterForm />
    </div>
  );
}
