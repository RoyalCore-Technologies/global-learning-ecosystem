import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

// Protected AI learning assistant routes require runtime session authentication
export const dynamic = 'force-dynamic';

export default async function AiAssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthUser('/ai-assistant');
  if (!user) {
    throw new Error('Unauthenticated access to AI learning core');
  }
  return <>{children}</>;
}
