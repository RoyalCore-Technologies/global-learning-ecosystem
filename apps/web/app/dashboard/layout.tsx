import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

// Protected dashboard routes require runtime session authentication
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthUser('/dashboard');
  if (!user) {
    throw new Error('Unauthenticated access to dashboard');
  }
  return <>{children}</>;
}
