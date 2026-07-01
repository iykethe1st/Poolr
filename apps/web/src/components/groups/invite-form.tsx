'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HTTPError } from 'ky';
import { CheckCircle2, Copy, Loader2, Mail, Phone } from 'lucide-react';
import type { ApiResponse } from '@poolr/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInviteMember } from '@/hooks/use-group';

const schema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email('Enter a valid email').optional(),
  })
  .refine((v) => v.phone || v.email, {
    message: 'Enter a phone number or email address',
    path: ['phone'],
  });

type FormValues = z.infer<typeof schema>;

interface InviteFormProps {
  groupId: string;
  groupName: string;
}

export function InviteForm({ groupId, groupName }: InviteFormProps) {
  const { mutateAsync, isPending } = useInviteMember(groupId);
  const [success, setSuccess] = useState<{ message: string; slotCount: number; token: string } | null>(null);
  const [serverError, setServerError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'phone' | 'email'>('phone');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError('');
    setSuccess(null);
    try {
      const result = await mutateAsync({
        phone: mode === 'phone' ? values.phone : undefined,
        email: mode === 'email' ? values.email : undefined,
      });
      setSuccess(result);
      reset();
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<ApiResponse>();
        const msg = body.message ?? 'Failed to send invite.';
        setServerError(Array.isArray(msg) ? msg[0] : msg);
      } else {
        setServerError('Failed to send invite. Please try again.');
      }
    }
  }

  async function copyLink(token: string) {
    const link = `${window.location.origin}/groups/${groupId}/join?token=${token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex rounded-lg border p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('phone')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'phone'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Phone className="size-3.5" />
          Phone
        </button>
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'email'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mail className="size-3.5" />
          Email
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {mode === 'phone' ? (
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+2348012345678"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="member@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
        )}

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending invite…
            </>
          ) : (
            `Send invite to ${groupName}`
          )}
        </Button>
      </form>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3 dark:border-emerald-800 dark:bg-emerald-950">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="size-4" />
            {success.message}
            {success.slotCount > 1 && (
              <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs dark:bg-emerald-900">
                {success.slotCount} slots
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Share this link as an alternative:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/groups/${groupId}/join?token=${success.token}`}
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyLink(success.token)}
              >
                {copied ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
