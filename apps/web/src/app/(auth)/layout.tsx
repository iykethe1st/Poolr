import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center">
            <Image src="/favicon.png" alt="Poolr Logo" width={45} height={45} />
            <span className="text-2xl font-bold tracking-tight"> Poolr</span>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Rotating savings circles, reimagined.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
