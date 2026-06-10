import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Forgot your password?</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Password reset is coming soon. Please contact support for now.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
