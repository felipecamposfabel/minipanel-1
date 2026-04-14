import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MiniPanel',
  description: 'A minimal dashboard panel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
