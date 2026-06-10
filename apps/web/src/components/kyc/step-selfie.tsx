'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { Camera, ChevronLeft, ChevronRight, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;

type Mode = 'choose' | 'camera' | 'preview';

export function StepSelfie({
  defaultFile,
  defaultPreview,
  onBack,
  onNext,
}: {
  defaultFile: File | Blob | null;
  defaultPreview: string | null;
  onBack: () => void;
  onNext: (file: File | Blob, preview: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(defaultPreview ? 'preview' : 'choose');
  const [preview, setPreview] = useState<string | null>(defaultPreview);
  const [captured, setCaptured] = useState<Blob | null>(
    defaultFile instanceof Blob && !(defaultFile instanceof File) ? defaultFile : null,
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(
    defaultFile instanceof File ? defaultFile : null,
  );
  const [cameraError, setCameraError] = useState('');
  const [sizeError, setSizeError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('camera');
    } catch {
      setCameraError(
        "Camera not available. Make sure you've granted camera permission, or upload a photo instead.",
      );
    }
  }, []);

  // Stop camera when leaving camera mode
  useEffect(() => {
    if (mode !== 'camera' && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (blob.size > MAX_BYTES) {
          setSizeError('Captured image is too large. Please try again or upload a smaller photo.');
          return;
        }
        const url = URL.createObjectURL(blob);
        setCaptured(blob);
        setUploadedFile(null);
        setPreview(url);
        setMode('preview');
      },
      'image/jpeg',
      0.85,
    );
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setSizeError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setSizeError('File is too large (max 5 MB). Please choose a smaller photo.');
      return;
    }
    const url = URL.createObjectURL(file);
    setUploadedFile(file);
    setCaptured(null);
    setPreview(url);
    setMode('preview');
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaptured(null);
    setUploadedFile(null);
    setSizeError('');
    setMode('choose');
  }

  function handleNext() {
    const file = uploadedFile ?? captured;
    if (!file || !preview) return;
    onNext(file, preview);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Take a selfie</h2>
        <p className="text-sm text-muted-foreground">
          Take a clear photo of your face. Make sure you are in a well-lit area and look
          directly at the camera.
        </p>
      </div>

      {/* Choose mode */}
      {mode === 'choose' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={startCamera}
            className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:border-foreground/40 hover:bg-muted/30"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Camera className="size-5" />
            </span>
            <span>
              <p className="text-sm font-medium">Use camera</p>
              <p className="text-xs text-muted-foreground">Take a photo right now</p>
            </span>
          </button>

          <label className="flex w-full cursor-pointer items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:border-foreground/40 hover:bg-muted/30">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Upload className="size-5" />
            </span>
            <span>
              <p className="text-sm font-medium">Upload photo</p>
              <p className="text-xs text-muted-foreground">JPEG or PNG, max 5 MB</p>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
          {sizeError && <p className="text-sm text-destructive">{sizeError}</p>}
        </div>
      )}

      {/* Camera viewfinder */}
      {mode === 'camera' && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl bg-black">
            {/* Face oval guide */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <div className="h-48 w-36 rounded-[50%] border-2 border-white/60" />
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-64 w-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setMode('choose')}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={capture}>
              <Camera className="size-4" />
              Capture
            </Button>
          </div>
        </div>
      )}

      {/* Preview */}
      {mode === 'preview' && preview && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selfie preview" className="h-64 w-full object-cover" />
          </div>
          {sizeError && <p className="text-sm text-destructive">{sizeError}</p>}
          <button
            type="button"
            onClick={retake}
            className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <RefreshCw className="size-3.5" />
            Retake photo
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className={cn('flex gap-2', mode === 'camera' && 'hidden')}>
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={mode !== 'preview'}
          onClick={handleNext}
        >
          Continue
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
