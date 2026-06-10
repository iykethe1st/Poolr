import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sign in to your Poolr account
      </p>
      {/* TODO: wire up LoginForm component */}
      <div className="space-y-4">
        <div className="h-10 rounded-md bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-primary animate-pulse opacity-60" />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <a href="/register" className="font-medium text-primary hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
