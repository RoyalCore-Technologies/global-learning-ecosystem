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
});
