import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfilesService } from './profiles.service.js';
import { DatabaseService } from '../database/database.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProfilesService', () => {
  let service: ProfilesService;
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

    service = new ProfilesService(mockDatabaseService);
  });

  describe('getProfileByUsername', () => {
    it('throws NotFoundException when profile is not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(service.getProfileByUsername('unknown_user')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when account is banned', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'banned-id', username: 'banned_user', is_banned: true },
              error: null,
            }),
          }),
        }),
      });

      await expect(service.getProfileByUsername('banned_user')).rejects.toThrow(NotFoundException);
    });

    it('returns aggregated profile with follower and post counts', async () => {
      const mockProfile = {
        id: 'user-123',
        username: 'prof_vance',
        display_name: 'Prof Marcus Vance',
        role: 'EDUCATOR',
        verification_status: 'VERIFIED',
        is_banned: false,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
                count: 142,
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 18 }),
              }),
            }),
          };
        }
        return {};
      });

      const profile = await service.getProfileByUsername('prof_vance', 'caller-456');
      expect(profile).toBeDefined();
      expect(profile.username).toBe('prof_vance');
      expect(profile.role).toBe('EDUCATOR');
    });
  });

  describe('toggleFollow', () => {
    it('throws BadRequestException when user tries to follow themselves', async () => {
      await expect(service.toggleFollow('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target user does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(service.toggleFollow('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('inserts follow relationship when not following', async () => {
      const targetUser = { id: 'target-1', is_banned: false };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: targetUser, error: null }),
              }),
            }),
          };
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
                count: 1,
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.toggleFollow('user-1', 'target-1');
      expect(result.isFollowing).toBe(true);
    });

    it('deletes follow relationship when already following', async () => {
      const targetUser = { id: 'target-1', is_banned: false };
      const existingFollow = { id: 'rel-123' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: targetUser, error: null }),
              }),
            }),
          };
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingFollow }),
                }),
                count: 0,
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const result = await service.toggleFollow('user-1', 'target-1');
      expect(result.isFollowing).toBe(false);
    });
  });
});
