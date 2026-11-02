import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthUser('/dashboard');
  return <>{children}</>;
}
