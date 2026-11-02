import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionsService } from './interactions.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRole } from '@platform/types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('InteractionsService', () => {
  let service: InteractionsService;
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

    service = new InteractionsService(mockDatabaseService);
  });

  describe('toggleInteraction - Academic Endorsement Verification', () => {
    it('throws ForbiddenException when a STUDENT attempts an ENDORSE_ACCURACY endorsement', async () => {
      await expect(
        service.toggleInteraction('student-id', UserRole.STUDENT, 'post-1', 'ENDORSE_ACCURACY')
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a BEGINNER attempts an ENDORSE_ACCURACY endorsement', async () => {
      await expect(
        service.toggleInteraction('beginner-id', UserRole.BEGINNER, 'post-1', 'ENDORSE_ACCURACY')
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an EDUCATOR to perform an ENDORSE_ACCURACY endorsement', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'post-1', status: 'PUBLISHED', upvote_count: 5 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'interactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                  count: 1,
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.toggleInteraction(
        'prof-id',
        UserRole.EDUCATOR,
        'post-1',
        'ENDORSE_ACCURACY'
      );

      expect(result.isInteracted).toBe(true);
      expect(result.type).toBe('ENDORSE_ACCURACY');
    });

    it('allows a RESEARCHER to perform an ENDORSE_ACCURACY endorsement', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'post-1', status: 'PUBLISHED', upvote_count: 10 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'interactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                  count: 1,
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.toggleInteraction(
        'researcher-id',
        UserRole.RESEARCHER,
        'post-1',
        'ENDORSE_ACCURACY'
      );

      expect(result.isInteracted).toBe(true);
      expect(result.type).toBe('ENDORSE_ACCURACY');
    });

    it('allows a STUDENT to cast an UPVOTE_INSIGHTFUL vote', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'post-1', status: 'PUBLISHED', upvote_count: 1 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'interactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                  count: 1,
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.toggleInteraction(
        'student-id',
        UserRole.STUDENT,
        'post-1',
        'UPVOTE_INSIGHTFUL'
      );

      expect(result.isInteracted).toBe(true);
      expect(result.type).toBe('UPVOTE_INSIGHTFUL');
    });

    it('toggles off an existing interaction', async () => {
      const existingInter = { id: 'inter-999' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'post-1', status: 'PUBLISHED', upvote_count: 1 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'interactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: existingInter }),
                  }),
                  count: 0,
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

      const result = await service.toggleInteraction(
        'student-id',
        UserRole.STUDENT,
        'post-1',
        'UPVOTE_INSIGHTFUL'
      );

      expect(result.isInteracted).toBe(false);
    });

    it('throws NotFoundException when post does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(
        service.toggleInteraction('student-id', UserRole.STUDENT, 'nonexistent-id', 'UPVOTE_INSIGHTFUL')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleBookmark', () => {
    it('throws NotFoundException when post does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(
        service.toggleBookmark('user-1', 'nonexistent-post', {})
      ).rejects.toThrow(NotFoundException);
    });

    it('adds a bookmark when not bookmarked', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'post-1' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.toggleBookmark('user-1', 'post-1', {
        collection_name: 'Distributed Systems',
      });
      expect(result.isBookmarked).toBe(true);
    });

    it('removes a bookmark when already bookmarked', async () => {
      const existingBookmark = { id: 'bm-123' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'post-1' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingBookmark }),
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

      const result = await service.toggleBookmark('user-1', 'post-1', {});
      expect(result.isBookmarked).toBe(false);
    });
  });
});
