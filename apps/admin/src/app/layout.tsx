import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poolr Admin',
  description: 'Admin and collector dashboard.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
