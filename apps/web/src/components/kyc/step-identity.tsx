'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { IdentityData } from './kyc-flow';

const schema = z
  .object({
    idType: z.enum(['bvn', 'nin']),
    idNumber: z
      .string()
      .length(11, 'Must be exactly 11 digits')
      .regex(/^\d{11}$/, 'Must be 11 digits only'),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
      .refine((d) => {
        const date = new Date(d);
        const now = new Date();
        const age = now.getFullYear() - date.getFullYear();
        return age >= 18;
      }, 'You must be at least 18 years old'),
  });

type FormValues = z.infer<typeof schema>;

export function StepIdentity({
  defaultValues,
  onNext,
}: {
  defaultValues: IdentityData | null;
  onNext: (data: IdentityData) => void;
}) {
  const [idType, setIdType] = useState<'bvn' | 'nin'>(defaultValues?.idType ?? 'bvn');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      idType: defaultValues?.idType ?? 'bvn',
      idNumber: defaultValues?.idNumber ?? '',
      dateOfBirth: defaultValues?.dateOfBirth ?? '',
    },
  });

  function selectType(type: 'bvn' | 'nin') {
    setIdType(type);
    setValue('idType', type);
    setValue('idNumber', '');
  }

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Verify your identity</h2>
        <p className="text-sm text-muted-foreground">
          Your BVN or NIN is used to confirm your identity. It is never shared with third
          parties.
        </p>
      </div>

      {/* ID type toggle */}
      <div className="space-y-2">
        <Label>Identification type</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['bvn', 'nin'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                idType === type
                  ? 'border-foreground bg-foreground/5 font-medium'
                  : 'border-border text-muted-foreground hover:border-foreground/40',
              )}
            >
              <p className="text-sm font-semibold uppercase">{type}</p>
              <p className="text-xs text-muted-foreground">
                {type === 'bvn' ? 'Bank Verification Number' : 'National ID Number'}
              </p>
            </button>
          ))}
        </div>
        <input type="hidden" {...register('idType')} />
      </div>

      {/* ID number */}
      <div className="space-y-1.5">
        <Label htmlFor="idNumber">{idType.toUpperCase()} number</Label>
        <Input
          id="idNumber"
          inputMode="numeric"
          maxLength={11}
          placeholder={`Enter your 11-digit ${idType.toUpperCase()}`}
          {...register('idNumber')}
        />
        {errors.idNumber && (
          <p className="text-xs text-destructive">{errors.idNumber.message}</p>
        )}
      </div>

      {/* Date of birth */}
      <div className="space-y-1.5">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
            .toISOString()
            .split('T')[0]}
          {...register('dateOfBirth')}
        />
        {errors.dateOfBirth && (
          <p className="text-xs text-destructive">{errors.dateOfBirth.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="size-4" />
      </Button>
    </form>
  );
}
