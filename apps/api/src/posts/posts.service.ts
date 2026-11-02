import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CreatePostDto } from './dto/create-post.dto.js';
import type { UpdatePostDto } from './dto/update-post.dto.js';
import type { FeedQueryDto } from './dto/feed-query.dto.js';
import type { Post } from '@platform/types';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Generates a clean URL slug from title.
   */
  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${randomSuffix}`.substring(0, 80);
  }

  /**
   * Creates a new educational knowledge post with tag associations.
   */
  async createPost(authorId: string, dto: CreatePostDto): Promise<Post> {
    const client = this.databaseService.getClient();

    const slug = dto.slug?.trim() || this.generateSlug(dto.title);

    // Verify slug uniqueness
    const { data: existingSlug } = await client
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const { data: newPost, error: insertError } = await client
      .from('posts')
      .insert({
        author_id: authorId,
        title: dto.title.trim(),
        slug: finalSlug,
        summary: dto.summary?.trim() || null,
        content: dto.content,
        type: dto.type || 'ARTICLE',
        status: dto.status || 'PUBLISHED',
        cover_image_url: dto.cover_image_url || null,
        published_at: dto.status === 'DRAFT' ? null : new Date().toISOString(),
      })
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status, headline)')
      .single();

    if (insertError || !newPost) {
      this.logger.error(`Failed to insert post: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to create knowledge post.');
    }

    // Associate tags if provided
    if (dto.tags && dto.tags.length > 0) {
      await this.syncPostTags(newPost.id, dto.tags);
    }

    const tags = await this.getPostTags(newPost.id);

    return {
      ...newPost,
      tags,
    } as Post;
  }

  /**
   * Retrieves educational feed posts based on ranking strategy, category and tag filters.
   */
  async getFeed(
    query: FeedQueryDto,
    currentUserId?: string
  ): Promise<{ data: Post[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let postsQuery = client
      .from('posts')
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status, headline)', {
        count: 'exact',
      })
      .eq('status', 'PUBLISHED');

    // Filter by post type if specified
    if (query.type) {
      postsQuery = postsQuery.eq('type', query.type);
    }

    // Filter by tag if specified
    if (query.tag) {
      const cleanTag = query.tag.toLowerCase().trim();
      const { data: tagRecord } = await client
        .from('tags')
        .select('id')
        .eq('slug', cleanTag)
        .maybeSingle();

      if (tagRecord) {
        const { data: taggedPosts } = await client
          .from('post_tags')
          .select('post_id')
          .eq('tag_id', tagRecord.id);

        const postIds = (taggedPosts || []).map((tp) => tp.post_id);
        postsQuery = postsQuery.in('id', postIds.length > 0 ? postIds : ['00000000-0000-0000-0000-000000000000']);
      } else {
        return { data: [], total: 0, page, limit };
      }
    }

    // Full-text search
    if (query.search) {
      const searchTerms = query.search.trim().replace(/[^\w\s]/g, '');
      if (searchTerms) {
        postsQuery = postsQuery.or(`title.ilike.%${searchTerms}%,summary.ilike.%${searchTerms}%`);
      }
    }

    // Ranking strategies
    if (query.feed === 'following') {
      if (!currentUserId) {
        return { data: [], total: 0, page, limit };
      }

      const { data: followRecords } = await client
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const followingIds = (followRecords || []).map((f) => f.following_id);
      if (followingIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      postsQuery = postsQuery.in('author_id', followingIds);
      postsQuery = postsQuery.order('published_at', { ascending: false });
    } else if (query.feed === 'endorsed') {
      // Academic accuracy and peer endorsement ranking
      postsQuery = postsQuery
        .order('upvote_count', { ascending: false })
        .order('published_at', { ascending: false });
    } else {
      // Recent discovery ranking (default)
      postsQuery = postsQuery.order('published_at', { ascending: false });
    }

    const { data: posts, count, error } = await postsQuery.range(from, to);

    if (error) {
      this.logger.error(`Failed to fetch feed: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve knowledge feed.');
    }

    if (!posts || posts.length === 0) {
      return { data: [], total: count || 0, page, limit };
    }

    // Attach tags and user interaction states in batch
    const postIds = posts.map((p) => p.id);
    const [tagsMap, userInteractionsMap] = await Promise.all([
      this.getBatchPostTags(postIds),
      currentUserId ? this.getBatchUserInteractions(postIds, currentUserId) : Promise.resolve(new Map()),
    ]);

    const enrichedPosts = posts.map((post) => ({
      ...post,
      tags: tagsMap.get(post.id) || [],
      user_interactions: userInteractionsMap.get(post.id) || {
        has_upvoted: false,
        has_endorsed: false,
        has_bookmarked: false,
      },
    }));

    return {
      data: enrichedPosts as Post[],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Retrieves single knowledge post by unique slug and tracks views.
   */
  async getPostBySlug(slug: string, currentUserId?: string): Promise<Post> {
    const client = this.databaseService.getClient();

    const { data: post, error } = await client
      .from('posts')
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status, headline)')
      .eq('slug', slug)
      .single();

    if (error || !post) {
      throw new NotFoundException(`Post with slug '${slug}' was not found.`);
    }

    // Visibility safeguard: drafts can only be viewed by author
    if (post.status !== 'PUBLISHED' && post.author_id !== currentUserId) {
      throw new NotFoundException(`Post with slug '${slug}' was not found.`);
    }

    // Asynchronously increment view count without blocking response
    client
      .from('posts')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', post.id)
      .then();

    const [tags, userInteractions] = await Promise.all([
      this.getPostTags(post.id),
      currentUserId ? this.getUserInteractions(post.id, currentUserId) : Promise.resolve({
        has_upvoted: false,
        has_endorsed: false,
        has_bookmarked: false,
      }),
    ]);

    return {
      ...post,
      tags,
      user_interactions: userInteractions,
    } as Post;
  }

  /**
   * Updates an existing post with strict ownership verification.
   */
  async updatePost(
    postId: string,
    userId: string,
    isAdmin: boolean,
    dto: UpdatePostDto
  ): Promise<Post> {
    const client = this.databaseService.getClient();

    // Verify post existence and author ownership
    const { data: existingPost, error: findError } = await client
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .single();

    if (findError || !existingPost) {
      throw new NotFoundException('Post not found.');
    }

    if (existingPost.author_id !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to edit this post.');
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) payload.title = dto.title.trim();
    if (dto.summary !== undefined) payload.summary = dto.summary?.trim() || null;
    if (dto.content !== undefined) payload.content = dto.content;
    if (dto.type !== undefined) payload.type = dto.type;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.cover_image_url !== undefined) payload.cover_image_url = dto.cover_image_url;
    if (dto.is_pinned !== undefined) payload.is_pinned = dto.is_pinned;

    const { data: updatedPost, error: updateError } = await client
      .from('posts')
      .update(payload)
      .eq('id', postId)
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status, headline)')
      .single();

    if (updateError || !updatedPost) {
      this.logger.error(`Failed to update post: ${updateError?.message}`);
      throw new InternalServerErrorException('Failed to update post.');
    }

    if (dto.tags) {
      await this.syncPostTags(postId, dto.tags);
    }

    const tags = await this.getPostTags(postId);

    return {
      ...updatedPost,
      tags,
    } as Post;
  }

  /**
   * Deletes a post with strict ownership check.
   */
  async deletePost(postId: string, userId: string, isAdmin: boolean): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: existingPost, error: findError } = await client
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .single();

    if (findError || !existingPost) {
      throw new NotFoundException('Post not found.');
    }

    if (existingPost.author_id !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this post.');
    }

    const { error: deleteError } = await client
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      this.logger.error(`Failed to delete post: ${deleteError.message}`);
      throw new InternalServerErrorException('Failed to delete post.');
    }
  }

  // --- Tag & Interaction Helpers ---

  private async syncPostTags(postId: string, tags: string[]): Promise<void> {
    const client = this.databaseService.getClient();

    // 1. Delete existing associations
    await client.from('post_tags').delete().eq('post_id', postId);

    for (const rawTag of tags) {
      const cleanName = rawTag.toLowerCase().trim();
      const slug = cleanName.replace(/[^a-z0-9]+/g, '-');
      if (!slug) continue;

      // Upsert tag
      let tagId: string | null = null;
      const { data: existingTag } = await client
        .from('tags')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag } = await client
          .from('tags')
          .insert({ name: cleanName, slug })
          .select('id')
          .single();
        if (newTag) tagId = newTag.id;
      }

      if (tagId) {
        await client.from('post_tags').insert({ post_id: postId, tag_id: tagId });
      }
    }
  }

  private async getPostTags(postId: string): Promise<string[]> {
    const client = this.databaseService.getClient();
    const { data: postTags } = await client
      .from('post_tags')
      .select('tag:tag_id(slug)')
      .eq('post_id', postId);

    return (postTags || []).map((pt: any) => pt.tag?.slug).filter(Boolean);
  }

  private async getBatchPostTags(postIds: string[]): Promise<Map<string, string[]>> {
    const client = this.databaseService.getClient();
    const map = new Map<string, string[]>();

    const { data: postTags } = await client
      .from('post_tags')
      .select('post_id, tag:tag_id(slug)')
      .in('post_id', postIds);

    for (const pt of postTags || []) {
      const existing = map.get(pt.post_id) || [];
      const slug = (pt as any).tag?.slug;
      if (slug) existing.push(slug);
      map.set(pt.post_id, existing);
    }

    return map;
  }

  private async getUserInteractions(
    postId: string,
    userId: string
  ): Promise<{ has_upvoted: boolean; has_endorsed: boolean; has_bookmarked: boolean }> {
    const client = this.databaseService.getClient();

    const [interactionsRes, bookmarkRes] = await Promise.all([
      client.from('interactions').select('type').eq('post_id', postId).eq('user_id', userId),
      client.from('bookmarks').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
    ]);

    const types = (interactionsRes.data || []).map((i) => i.type);
    return {
      has_upvoted: types.includes('UPVOTE_INSIGHTFUL'),
      has_endorsed: types.includes('ENDORSE_ACCURACY'),
      has_bookmarked: !!bookmarkRes.data,
    };
  }

  private async getBatchUserInteractions(
    postIds: string[],
    userId: string
  ): Promise<Map<string, { has_upvoted: boolean; has_endorsed: boolean; has_bookmarked: boolean }>> {
    const client = this.databaseService.getClient();
    const map = new Map<string, { has_upvoted: boolean; has_endorsed: boolean; has_bookmarked: boolean }>();

    const [interactionsRes, bookmarksRes] = await Promise.all([
      client.from('interactions').select('post_id, type').in('post_id', postIds).eq('user_id', userId),
      client.from('bookmarks').select('post_id').in('post_id', postIds).eq('user_id', userId),
    ]);

    for (const pid of postIds) {
      map.set(pid, { has_upvoted: false, has_endorsed: false, has_bookmarked: false });
    }

    for (const inter of interactionsRes.data || []) {
      const curr = map.get(inter.post_id);
      if (curr) {
        if (inter.type === 'UPVOTE_INSIGHTFUL') curr.has_upvoted = true;
        if (inter.type === 'ENDORSE_ACCURACY') curr.has_endorsed = true;
      }
    }

    for (const bm of bookmarksRes.data || []) {
      const curr = map.get(bm.post_id);
      if (curr) curr.has_bookmarked = true;
    }

    return map;
  }
}
