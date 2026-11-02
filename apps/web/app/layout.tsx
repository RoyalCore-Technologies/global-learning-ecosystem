import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Global Learning & Social Ecosystem',
  description: 'A knowledge-first social and learning ecosystem for students, educators, and creators.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
