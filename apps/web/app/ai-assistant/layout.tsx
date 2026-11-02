import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

export default async function AiAssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthUser('/ai-assistant');
  return <>{children}</>;
}
