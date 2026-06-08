import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poolr',
  description: 'Rotating savings circles, reimagined for the modern age.',
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
