'use client';

import { useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadKycFile, submitKycIdentity, extractHttpError } from '@/lib/kyc-api';
import type { KycState } from './kyc-flow';

type SubmitResult = { kycStatus: string; message: string; attemptsLeft: number };

export function StepReview({
  kycData,
  onBack,
  onDone,
}: {
  kycData: KycState;
  onBack: () => void;
  onDone: (result: SubmitResult) => void;
}) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState('');

  const { identity, selfieFile, selfiePreview, documentFile, documentName } = kycData;

  async function handleSubmit() {
    if (!identity) return;
    setError('');
    setSubmitting(true);

    try {
      // 1. Upload selfie
      if (selfieFile) {
        setStage('Uploading selfie…');
        const ext = selfieFile instanceof File ? selfieFile.name : 'selfie.jpg';
        await uploadKycFile('selfie', selfieFile, ext);
      }

      // 2. Upload ID document
      if (documentFile) {
        setStage('Uploading document…');
        await uploadKycFile('document', documentFile, documentFile.name);
      }

      // 3. Submit identity for verification
      setStage('Verifying identity…');
      const result = await submitKycIdentity({
        [identity.idType]: identity.idNumber,
        dateOfBirth: identity.dateOfBirth,
      });

      onDone({
        kycStatus: result.kycStatus,
        message: result.message,
        attemptsLeft: 3 - result.kycAttempts,
      });
    } catch (err) {
      setError(await extractHttpError(err));
    } finally {
      setSubmitting(false);
      setStage('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Review and submit</h2>
        <p className="text-sm text-muted-foreground">
          Check your details before submitting. You have up to 3 verification attempts.
        </p>
      </div>

      {/* Identity details */}
      <Section title="Identity">
        <Row label={identity?.idType.toUpperCase() ?? ''} value={identity?.idNumber ?? ''} />
        <Row label="Date of birth" value={identity?.dateOfBirth ?? ''} />
      </Section>

      {/* Selfie */}
      <Section title="Selfie">
        {selfiePreview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={selfiePreview}
            alt="Selfie"
            className="h-32 w-24 rounded-lg object-cover"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No selfie</p>
        )}
      </Section>

      {/* Document */}
      <Section title="ID document">
        <p className="text-sm">{documentName ?? 'No document'}</p>
      </Section>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {submitting && stage && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {stage}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={submitting} className="flex-1">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Submit for verification
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
