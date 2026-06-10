'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getMe } from '@/lib/kyc-api';
import { KycStatus } from './kyc-status';
import { StepIdentity } from './step-identity';
import { StepSelfie } from './step-selfie';
import { StepDocument } from './step-document';
import { StepReview } from './step-review';

export type IdentityData = {
  idType: 'bvn' | 'nin';
  idNumber: string;
  dateOfBirth: string;
};

export type KycState = {
  identity: IdentityData | null;
  selfieFile: File | Blob | null;
  selfiePreview: string | null;
  documentFile: File | null;
  documentName: string | null;
};

type Screen =
  | { type: 'loading' }
  | { type: 'form'; step: 0 | 1 | 2 | 3 }
  | { type: 'status'; kycStatus: string; message: string; attemptsLeft: number };

const STEPS = ['Identity', 'Selfie', 'Document', 'Review'];

export function KycFlow() {
  const [screen, setScreen] = useState<Screen>({ type: 'loading' });
  const [kycData, setKycData] = useState<KycState>({
    identity: null,
    selfieFile: null,
    selfiePreview: null,
    documentFile: null,
    documentName: null,
  });

  useEffect(() => {
    getMe()
      .then((user) => {
        const kyc = user.kycProfile;
        if (!kyc || kyc.kycStatus === 'PENDING') {
          setScreen({ type: 'form', step: 0 });
        } else {
          setScreen({
            type: 'status',
            kycStatus: kyc.kycStatus,
            message: '',
            attemptsLeft: 3,
          });
        }
      })
      .catch(() => setScreen({ type: 'form', step: 0 }));
  }, []);

  function nextStep(step: 0 | 1 | 2 | 3) {
    const next = (step + 1) as 0 | 1 | 2 | 3;
    setScreen({ type: 'form', step: next });
  }

  function prevStep(step: 0 | 1 | 2 | 3) {
    if (step === 0) return;
    setScreen({ type: 'form', step: (step - 1) as 0 | 1 | 2 | 3 });
  }

  function onSubmitDone(result: { kycStatus: string; message: string; attemptsLeft: number }) {
    setScreen({ type: 'status', ...result });
  }

  if (screen.type === 'loading') {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (screen.type === 'status') {
    return (
      <KycStatus
        kycStatus={screen.kycStatus}
        message={screen.message}
        attemptsLeft={screen.attemptsLeft}
        onRetry={() => setScreen({ type: 'form', step: 0 })}
      />
    );
  }

  const { step } = screen;

  return (
    <div className="space-y-8">
      <StepIndicator current={step} steps={STEPS} />

      {step === 0 && (
        <StepIdentity
          defaultValues={kycData.identity}
          onNext={(identity) => {
            setKycData((d) => ({ ...d, identity }));
            nextStep(0);
          }}
        />
      )}
      {step === 1 && (
        <StepSelfie
          defaultFile={kycData.selfieFile}
          defaultPreview={kycData.selfiePreview}
          onBack={() => prevStep(1)}
          onNext={(file, preview) => {
            setKycData((d) => ({ ...d, selfieFile: file, selfiePreview: preview }));
            nextStep(1);
          }}
        />
      )}
      {step === 2 && (
        <StepDocument
          defaultFile={kycData.documentFile}
          defaultName={kycData.documentName}
          onBack={() => prevStep(2)}
          onNext={(file, name) => {
            setKycData((d) => ({ ...d, documentFile: file, documentName: name }));
            nextStep(2);
          }}
        />
      )}
      {step === 3 && (
        <StepReview
          kycData={kycData}
          onBack={() => prevStep(3)}
          onDone={onSubmitDone}
        />
      )}
    </div>
  );
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="relative flex items-center justify-between">
      {/* connecting line */}
      <div className="absolute inset-x-0 top-4 h-px bg-border" aria-hidden />
      <div
        className="absolute top-4 h-px bg-foreground transition-all duration-300"
        style={{ width: `${(current / (steps.length - 1)) * 100}%` }}
        aria-hidden
      />

      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="relative flex flex-col items-center gap-2">
            <span
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                done && 'border-foreground bg-foreground text-background',
                active && 'border-foreground bg-background text-foreground',
                !done && !active && 'border-border bg-background text-muted-foreground',
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={cn(
                'text-xs font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
