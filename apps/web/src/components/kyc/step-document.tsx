'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/jpg,image/png,application/pdf';

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function StepDocument({
  defaultFile,
  defaultName,
  onBack,
  onNext,
}: {
  defaultFile: File | null;
  defaultName: string | null;
  onBack: () => void;
  onNext: (file: File, name: string) => void;
}) {
  const [file, setFile] = useState<File | null>(defaultFile);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function accept(f: File) {
    setError('');
    if (f.size > MAX_BYTES) {
      setError(`File is too large (${formatBytes(f.size)}). Maximum allowed size is 5 MB.`);
      return;
    }
    const okType = /^(image\/(jpeg|jpg|png)|application\/pdf)$/.test(f.type);
    if (!okType) {
      setError('Only JPEG, PNG and PDF files are accepted.');
      return;
    }
    setFile(f);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) accept(f);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Upload ID document</h2>
        <p className="text-sm text-muted-foreground">
          Upload a government-issued ID such as your passport, driver&apos;s licence, or
          national ID card. Both sides if applicable.
        </p>
      </div>

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
            dragging
              ? 'border-foreground bg-foreground/5'
              : 'border-border hover:border-foreground/40 hover:bg-muted/20',
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Upload className="size-6 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">Drag &amp; drop or click to upload</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              JPEG, PNG or PDF &nbsp;·&nbsp; Max 5 MB
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => { setFile(null); setError(''); }}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={handleChange}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={!file}
          onClick={() => file && onNext(file, file.name)}
        >
          Continue
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
