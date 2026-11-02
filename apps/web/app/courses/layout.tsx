import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

export default async function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthUser('/courses');
  return <>{children}</>;
}
