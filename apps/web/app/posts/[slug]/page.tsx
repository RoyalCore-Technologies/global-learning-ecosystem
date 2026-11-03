import React from 'react';
import { PostDetailView } from './post-detail-view';

interface PostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  return <PostDetailView slug={slug} />;
}
