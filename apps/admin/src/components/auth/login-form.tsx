'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HTTPError } from 'ky';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setToken } from '@/lib/auth';
import { apiClient } from '@/lib/api';

type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: string };
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiClient
        .post('auth/login', { json: { email, password } })
        .json<LoginResponse>();

      if (!['ADMIN', 'SUPER_ADMIN'].includes(res.user.role)) {
        setError('Access denied. Admin role required.');
        return;
      }

      setToken(res.accessToken);
      const redirect = searchParams.get('redirect') ?? '/';
      router.push(redirect);
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<{ message?: string }>();
        setError(body.message ?? 'Invalid credentials');
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <Input
          id="email"
          type="email"
          placeholder="admin@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
