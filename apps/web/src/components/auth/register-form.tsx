'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HTTPError } from 'ky';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/api';
import type { ApiResponse } from '@poolr/types';

const schema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Enter a valid email address'),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, 'Enter phone with country code, e.g. +2348012345678'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      await authClient
        .post('auth/register', {
          json: {
            fullName: values.fullName,
            email: values.email,
            phone: values.phone,
            password: values.password,
          },
        })
        .json();

      // Pass phone to the verify page via sessionStorage
      sessionStorage.setItem('poolr_verify_phone', values.phone);
      router.push('/verify-otp');
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<ApiResponse>();
        setServerError(body.message ?? 'Something went wrong. Please try again.');
      } else {
        setServerError('Network error. Check your connection and try again.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Full name" error={errors.fullName?.message}>
        <Input
          id="fullName"
          placeholder="Amara Obi"
          autoComplete="name"
          {...register('fullName')}
        />
      </Field>

      <Field label="Email address" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          placeholder="amara@example.com"
          autoComplete="email"
          {...register('email')}
        />
      </Field>

      <Field
        label="Phone number"
        error={errors.phone?.message}
        hint="Include country code, e.g. +2348012345678"
      >
        <Input
          id="phone"
          type="tel"
          placeholder="+2348012345678"
          autoComplete="tel"
          {...register('phone')}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          {...register('password')}
        />
      </Field>

      <Field label="Confirm password" error={errors.confirmPassword?.message}>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Repeat your password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
      </Field>

      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
