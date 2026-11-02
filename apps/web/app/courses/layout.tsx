import React from 'react';
import { requireAuthUser } from '@/lib/supabase/server';

// Protected course progress and enrollment routes require runtime session authentication
export const dynamic = 'force-dynamic';

export default async function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthUser('/courses');
  if (!user) {
    throw new Error('Unauthenticated access to courses');
  }
  return <>{children}</>;
}
