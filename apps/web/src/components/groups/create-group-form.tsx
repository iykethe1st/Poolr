'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HTTPError } from 'ky';
import Link from 'next/link';
import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApiResponse } from '@poolr/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCreateGroup } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  contributionAmount: z
    .number({ message: 'Enter a valid amount' })
    .min(100, 'Minimum contribution is ₦100'),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  maxMembers: z
    .number({ message: 'Enter a valid number' })
    .int()
    .min(3, 'Minimum 3 members')
    .max(50, 'Maximum 50 members'),
  startDate: z.string().optional(),
  penaltyEnabled: z.boolean(),
  penaltyPercentage: z.number().min(1).max(100).optional(),
});

type FormValues = z.infer<typeof schema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function CreateGroupForm() {
  const router = useRouter();
  const { data: me } = useCurrentUser();
  const { mutateAsync, isPending } = useCreateGroup();
  const [serverError, setServerError] = useState('');

  if (me && me.kycProfile?.kycStatus !== 'VERIFIED') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card py-12 text-center px-6">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/40">
          <ShieldCheck className="size-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-semibold">Identity verification required</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            You need to verify your identity before creating a savings group. This protects
            all members of your circle.
          </p>
        </div>
        <Button asChild>
          <Link href={`/kyc?redirect=${encodeURIComponent('/groups/new')}`}>
            Verify identity
          </Link>
        </Button>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      frequency: 'MONTHLY',
      maxMembers: 5,
      penaltyEnabled: false,
    },
  });

  const penaltyEnabled = watch('penaltyEnabled');

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      const penaltyConfig = values.penaltyEnabled
        ? { enabled: true, percentage: values.penaltyPercentage ?? 5 }
        : { enabled: false };

      const group = await mutateAsync({
        name: values.name,
        contributionAmount: values.contributionAmount,
        frequency: values.frequency,
        maxMembers: values.maxMembers,
        startDate: values.startDate || undefined,
        penaltyConfig,
      });

      router.push(`/groups/${group.id}/invite`);
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<ApiResponse>();
        const msg = body.message ?? 'Failed to create group.';
        setServerError(Array.isArray(msg) ? msg[0] : msg);
      } else {
        setServerError('Failed to create group. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {serverError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Group name</Label>
        <Input id="name" placeholder="e.g. Family Ajo 2025" {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>

      {/* Amount + Frequency */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contributionAmount">Contribution amount (NGN)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              &#x20a6;
            </span>
            <Input
              id="contributionAmount"
              type="number"
              min="100"
              step="100"
              className="pl-7"
              placeholder="10000"
              {...register('contributionAmount', { valueAsNumber: true })}
            />
          </div>
          <FieldError message={errors.contributionAmount?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="frequency">Frequency</Label>
          <Select id="frequency" {...register('frequency')}>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Bi-weekly</option>
            <option value="MONTHLY">Monthly</option>
          </Select>
          <FieldError message={errors.frequency?.message} />
        </div>
      </div>

      {/* Max members + Start date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="maxMembers">Maximum members</Label>
          <Input
            id="maxMembers"
            type="number"
            min="2"
            max="50"
            placeholder="5"
            {...register('maxMembers', { valueAsNumber: true })}
          />
          <FieldError message={errors.maxMembers?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startDate">
            Start date{' '}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="startDate"
            type="date"
            min={new Date().toISOString().split('T')[0]}
            {...register('startDate')}
          />
          <FieldError message={errors.startDate?.message} />
        </div>
      </div>

      {/* Penalty config */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Late payment penalties</p>
            <p className="text-xs text-muted-foreground">
              Charge members a percentage for overdue contributions
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              {...register('penaltyEnabled')}
            />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        </div>

        {penaltyEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="penaltyPercentage">Penalty rate (%)</Label>
            <div className="relative">
              <Input
                id="penaltyPercentage"
                type="number"
                min="1"
                max="100"
                placeholder="5"
                className="pr-8"
                {...register('penaltyPercentage', { valueAsNumber: true })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                %
              </span>
            </div>
            <FieldError message={errors.penaltyPercentage?.message} />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Only invite people you personally trust. If a member collects their payout and stops
          contributing, <strong>the loss is shared by everyone in the group.</strong> Poolr cannot
          recover funds from dishonest members.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Creating group&hellip;
          </>
        ) : (
          'Create group'
        )}
      </Button>
    </form>
  );
}
