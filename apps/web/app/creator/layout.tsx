import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthUser('/creator');
  return <>{children}</>;
}
