import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentsService } from './comments.service.js';
import { DatabaseService } from '../database/database.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CommentsService', () => {
  let service: CommentsService;
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

    service = new CommentsService(mockDatabaseService);
  });

  describe('getPostComments', () => {
    it('structures flat database rows into a nested reply tree with pinned comments first', async () => {
      const mockComments = [
        {
          id: 'c-root-1',
          post_id: 'p-1',
          parent_comment_id: null,
          content: 'First root comment',
          is_pinned: false,
          is_solution: false,
          created_at: '2026-11-02T10:00:00Z',
        },
        {
          id: 'c-reply-1',
          post_id: 'p-1',
          parent_comment_id: 'c-root-1',
          content: 'Reply to first root comment',
          is_pinned: false,
          is_solution: false,
          created_at: '2026-11-02T10:05:00Z',
        },
        {
          id: 'c-root-2',
          post_id: 'p-1',
          parent_comment_id: null,
          content: 'Second root comment pinned by author',
          is_pinned: true,
          is_solution: false,
          created_at: '2026-11-02T10:10:00Z',
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockComments, error: null }),
          }),
        }),
      });

      const tree = await service.getPostComments('p-1');
      expect(tree.length).toBe(2);
      // Pinned comment must float to top
      expect(tree[0].id).toBe('c-root-2');
      expect(tree[0].is_pinned).toBe(true);

      // First root comment should contain the reply in replies[]
      expect(tree[1].id).toBe('c-root-1');
      expect(tree[1].replies?.length).toBe(1);
      expect(tree[1].replies?.[0].id).toBe('c-reply-1');
    });
  });

  describe('createComment', () => {
    it('creates a root discussion comment', async () => {
      const post = { id: 'p-1', status: 'PUBLISHED' };
      const createdComment = {
        id: 'new-c-1',
        post_id: 'p-1',
        author_id: 'author-1',
        content: 'Great insight.',
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
          };
        }
        if (table === 'comments') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: createdComment, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await service.createComment('p-1', 'author-1', { content: 'Great insight.' });
      expect(res.id).toBe('new-c-1');
      expect(res.content).toBe('Great insight.');
    });

    it('rejects reply when parent comment belongs to a different post', async () => {
      const post = { id: 'p-1', status: 'PUBLISHED' };
      const parentComment = { id: 'p-c-other', post_id: 'different-post-id' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
          };
        }
        if (table === 'comments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: parentComment, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.createComment('p-1', 'author-1', {
          content: 'Mismatched reply',
          parent_comment_id: 'p-c-other',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateComment', () => {
    it('throws ForbiddenException when non-author attempts edit', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'c-1', author_id: 'real-author' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.updateComment('c-1', 'intruder', { content: 'Malicious edit' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('togglePin & toggleSolution', () => {
    it('throws ForbiddenException when non-post author attempts to pin a comment', async () => {
      const comment = { id: 'c-1', post_id: 'p-1', is_pinned: false };
      const post = { author_id: 'post-owner-123' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'comments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: comment, error: null }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.togglePin('c-1', 'random-user', false)).rejects.toThrow(ForbiddenException);
    });

    it('allows post author to mark accepted solution', async () => {
      const comment = { id: 'c-1', post_id: 'p-1', is_solution: false };
      const post = { author_id: 'post-owner-123' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'comments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: comment, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await service.toggleSolution('c-1', 'post-owner-123', false);
      expect(res.isSolution).toBe(true);
    });
  });
});
