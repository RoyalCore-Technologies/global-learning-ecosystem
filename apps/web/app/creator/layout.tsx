import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

// Protected creator studio routes require runtime session authentication
export const dynamic = 'force-dynamic';

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthUser('/creator');
  if (!user) {
    throw new Error('Unauthenticated access to creator studio');
  }
  return <>{children}</>;
}
