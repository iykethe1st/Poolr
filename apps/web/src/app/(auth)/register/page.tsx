import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Create an account</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Join Poolr and start saving together
      </p>
      {/* TODO: wire up RegisterForm component */}
      <div className="space-y-4">
        <div className="h-10 rounded-md bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-primary animate-pulse opacity-60" />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
