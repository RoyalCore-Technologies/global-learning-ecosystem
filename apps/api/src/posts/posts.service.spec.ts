import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostsService } from './posts.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('PostsService', () => {
  let service: PostsService;
  let mockDatabaseService: DatabaseService;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = {
      from: vi.fn(),
    };

    mockDatabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
      getAdminClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as DatabaseService;

    service = new PostsService(mockDatabaseService);
  });

  describe('createPost', () => {
    it('generates a clean slug and creates a knowledge post', async () => {
      const authorId = 'author-uuid-123';
      const dto = {
        title: 'Formal Methods in Distributed Consensus',
        content: '# Distributed Systems Content',
        tags: ['distributed-systems', 'consensus'],
      };

      const mockCreatedPost = {
        id: 'post-new-1',
        author_id: authorId,
        title: dto.title,
        slug: 'formal-methods-in-distributed-consensus-abc',
        content: dto.content,
        type: 'ARTICLE',
        status: 'PUBLISHED',
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCreatedPost, error: null }),
              }),
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'tag-1' } }),
              }),
            }),
          };
        }
        if (table === 'post_tags') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ tag: { slug: 'distributed-systems' } }, { tag: { slug: 'consensus' } }],
              }),
            }),
          };
        }
        return {};
      });

      const post = await service.createPost(authorId, dto as any);
      expect(post).toBeDefined();
      expect(post.title).toBe(dto.title);
      expect(post.tags).toContain('distributed-systems');
    });
  });

  describe('updatePost', () => {
    it('throws NotFoundException when post does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(
        service.updatePost('unknown-id', 'author-1', false, { title: 'New Title' })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-author tries to update post', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'post-1', author_id: 'original-author-id' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.updatePost('post-1', 'intruder-id', false, { title: 'Malicious Update' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows author to update their post', async () => {
      const existingPost = { id: 'post-1', author_id: 'author-1' };
      const updatedPost = { ...existingPost, title: 'Updated Title' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingPost, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedPost, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'post_tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        return {};
      });

      const result = await service.updatePost('post-1', 'author-1', false, { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('allows platform admin to update any post', async () => {
      const existingPost = { id: 'post-1', author_id: 'author-1' };
      const updatedPost = { ...existingPost, title: 'Admin Moderated Title' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingPost, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedPost, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'post_tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        return {};
      });

      const result = await service.updatePost('post-1', 'admin-user-id', true, { title: 'Admin Moderated Title' });
      expect(result.title).toBe('Admin Moderated Title');
    });
  });

  describe('deletePost', () => {
    it('throws ForbiddenException when non-author tries to delete post', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'post-1', author_id: 'original-author-id' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.deletePost('post-1', 'intruder-id', false)
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows author to delete their post', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'post-1', author_id: 'author-1' },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      await expect(service.deletePost('post-1', 'author-1', false)).resolves.not.toThrow();
    });
  });

  describe('community and channel associations & filters', () => {
    it('creates a post associated with a public community', async () => {
      const authorId = 'author-uuid-1';
      const dto = {
        title: 'Community Article',
        content: '# Community Insights',
        community_id: 'comm-123',
      };

      const mockCreated = {
        id: 'post-comm-1',
        author_id: authorId,
        community_id: 'comm-123',
        channel_id: null,
        title: dto.title,
        slug: 'community-article-abc',
        content: dto.content,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'comm-123', is_private: false, creator_id: 'creator-99' },
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
              }),
            }),
          };
        }
        if (table === 'post_tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        return {};
      });

      const res = await service.createPost(authorId, dto);
      expect(res.community_id).toBe('comm-123');
    });

    it('rejects posting to channel if user is not channel owner', async () => {
      const authorId = 'imposter-uuid';
      const dto = {
        title: 'Unauthorized Channel Broadcast',
        content: 'Broadcast content',
        channel_id: 'chan-123',
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_channels') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'chan-123', owner_id: 'actual-owner-uuid' },
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.createPost(authorId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('applies community_id and channel_id filters to getFeed', async () => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      mockSupabaseClient.from.mockReturnValue(chain);

      await service.getFeed({
        community_id: 'c-1',
        channel_id: 'ch-1',
        author_id: 'a-1',
      });

      expect(chain.eq).toHaveBeenCalledWith('community_id', 'c-1');
      expect(chain.eq).toHaveBeenCalledWith('channel_id', 'ch-1');
      expect(chain.eq).toHaveBeenCalledWith('author_id', 'a-1');
    });
  });
});
