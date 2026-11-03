import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommunitiesService } from './communities.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@platform/types';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
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

    service = new CommunitiesService(mockDatabaseService);
  });

  describe('getCommunities (Discovery)', () => {
    it('returns only public communities for unauthenticated visitors', async () => {
      const mockComms = [
        { id: 'comm-1', name: 'Open AI Guild', is_private: false, member_count: 50 },
        { id: 'comm-2', name: 'Rust Network', is_private: false, member_count: 30 },
      ];

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: mockComms, error: null, count: 2 });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getCommunities({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(chain.eq).toHaveBeenCalledWith('is_private', false);
    });

    it('allows platform admin to see private communities when requested', async () => {
      const mockComms = [{ id: 'comm-priv', name: 'Private Labs', is_private: true, member_count: 5 }];

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: mockComms, error: null, count: 1 });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getCommunities(
        { is_private: true, page: 1, limit: 10 },
        'admin-user-id',
        'ADMIN' as UserRole
      );

      expect(result.data).toHaveLength(1);
      expect(chain.eq).toHaveBeenCalledWith('is_private', true);
    });
  });

  describe('getCommunityBySlugOrId', () => {
    it('returns community details for a public community', async () => {
      const mockComm = {
        id: 'c1111111-1111-1111-1111-111111111111',
        name: 'Open Robotics',
        slug: 'open-robotics',
        is_private: false,
        member_count: 10,
      };

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockComm, error: null });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getCommunityBySlugOrId('open-robotics');

      expect(result.id).toBe(mockComm.id);
      expect(result.slug).toBe('open-robotics');
    });

    it('throws ForbiddenException if unauthenticated or non-member attempts to view private community', async () => {
      const mockComm = {
        id: 'c2222222-2222-2222-2222-222222222222',
        name: 'Private Citadel',
        slug: 'private-citadel',
        creator_id: 'creator-uuid-1',
        is_private: true,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockComm, error: null }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      await expect(
        service.getCommunityBySlugOrId('private-citadel', 'stranger-uuid', 'STUDENT' as UserRole)
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows community creator or member to access private community', async () => {
      const mockComm = {
        id: 'c2222222-2222-2222-2222-222222222222',
        name: 'Private Citadel',
        slug: 'private-citadel',
        creator_id: 'creator-uuid-1',
        is_private: true,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockComm, error: null }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'MEMBER', joined_at: '2026-11-03T00:00:00Z' },
              error: null,
            }),
          };
        }
        return {};
      });

      const result = await service.getCommunityBySlugOrId(
        'private-citadel',
        'creator-uuid-1',
        'CREATOR' as UserRole
      );
      expect(result.id).toBe(mockComm.id);
    });
  });

  describe('createCommunity', () => {
    it('creates community with sanitized fields and registers creator as LEAD', async () => {
      const mockCreated = {
        id: 'c-new',
        creator_id: 'creator-1',
        name: 'Machine Learning Guild',
        slug: 'machine-learning-guild',
        is_private: false,
        member_count: 0,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }), // slug uniqueness check
            single: vi.fn().mockResolvedValue({ data: { ...mockCreated, member_count: 1 }, error: null }),
            insert: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'community_members') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const result = await service.createCommunity('creator-1', {
        name: 'Machine Learning Guild',
        slug: 'machine-learning-guild',
      });

      expect(result.name).toBe('Machine Learning Guild');
    });
  });

  describe('updateCommunity', () => {
    it('allows creator to update settings', async () => {
      const existing = { id: 'comm-1', creator_id: 'creator-1' };
      const updated = { id: 'comm-1', name: 'Updated Name', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updated, error: null }),
      });

      const res = await service.updateCommunity('comm-1', 'creator-1', 'CREATOR' as UserRole, {
        name: 'Updated Name',
      });
      expect(res.name).toBe('Updated Name');
    });

    it('rejects update if user is not creator or admin', async () => {
      const existing = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing }),
      });

      await expect(
        service.updateCommunity('comm-1', 'stranger-2', 'STUDENT' as UserRole, { name: 'Hack' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteCommunity', () => {
    it('allows creator or platform admin to delete community', async () => {
      const existing = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing }),
        delete: vi.fn().mockReturnThis(),
      });

      await expect(
        service.deleteCommunity('comm-1', 'creator-1', 'CREATOR' as UserRole)
      ).resolves.not.toThrow();
    });

    it('blocks regular users from deleting community', async () => {
      const existing = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing }),
      });

      await expect(
        service.deleteCommunity('comm-1', 'stranger-1', 'STUDENT' as UserRole)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('joinCommunity & leaveCommunity (Idempotency & Private Access)', () => {
    it('joins public community and returns member record', async () => {
      const comm = { id: 'comm-pub', is_private: false, creator_id: 'creator-1' };
      const newMember = { id: 'm-1', community_id: 'comm-pub', user_id: 'user-2', role: 'MEMBER' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }), // not already joined
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: newMember, error: null }),
          };
        }
        return {};
      });

      const result = await service.joinCommunity('comm-pub', 'user-2', 'STUDENT' as UserRole);
      expect(result.role).toBe('MEMBER');
    });

    it('returns existing membership idempotently if already joined', async () => {
      const comm = { id: 'comm-pub', is_private: false, creator_id: 'creator-1' };
      const existingMember = { id: 'm-existing', community_id: 'comm-pub', user_id: 'user-2', role: 'MEMBER' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingMember }),
          };
        }
        return {};
      });

      const result = await service.joinCommunity('comm-pub', 'user-2', 'STUDENT' as UserRole);
      expect(result.id).toBe('m-existing');
    });

    it('blocks regular user from directly joining private community', async () => {
      const comm = { id: 'comm-priv', is_private: true, creator_id: 'creator-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          };
        }
        return {};
      });

      await expect(
        service.joinCommunity('comm-priv', 'stranger-user', 'STUDENT' as UserRole)
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents sole creator/LEAD from leaving without appointing another LEAD', async () => {
      const comm = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({ data: [] }), // no other leads
          };
        }
        return {};
      });

      await expect(service.leaveCommunity('comm-1', 'creator-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMemberRole', () => {
    it('allows LEAD to promote member to MODERATOR', async () => {
      const comm = { id: 'comm-1', creator_id: 'creator-1' };
      const promotedMember = { id: 'm-2', user_id: 'user-2', role: 'MODERATOR' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: promotedMember, error: null }),
          };
        }
        return {};
      });

      const res = await service.updateMemberRole(
        'comm-1',
        'user-2',
        'creator-1', // creator acting
        'CREATOR' as UserRole,
        { role: 'MODERATOR' }
      );

      expect(res.role).toBe('MODERATOR');
    });

    it('prevents demoting original creator from LEAD', async () => {
      const comm = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        return {};
      });

      await expect(
        service.updateMemberRole(
          'comm-1',
          'creator-1', // target is creator
          'admin-1', // acting is admin
          'ADMIN' as UserRole,
          { role: 'MEMBER' }
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('allows community creator or LEAD to remove a member', async () => {
      const comm = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        if (table === 'community_members') {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      await expect(
        service.removeMember('comm-1', 'bad-actor', 'creator-1', 'CREATOR' as UserRole)
      ).resolves.not.toThrow();
    });

    it('prevents kicking the original community creator', async () => {
      const comm = { id: 'comm-1', creator_id: 'creator-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: comm }),
          };
        }
        return {};
      });

      await expect(
        service.removeMember('comm-1', 'creator-1', 'admin-1', 'ADMIN' as UserRole)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
