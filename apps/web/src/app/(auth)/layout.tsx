export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold tracking-tight">Poolr</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Rotating savings circles, reimagined.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
