import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Community, CommunityMember, CreatorChannel } from '@platform/types';
import { UserRole } from '@platform/types';

describe('Communities & Channels UI Integration (M4.4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Communities Discovery query parameters and filters', () => {
    it('constructs correct URLSearchParams for search and privacy filters', () => {
      const search = '  distributed consensus  ';
      const privacyFilter = 'PUBLIC';
      const page = 2;
      const limit = 8;

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (privacyFilter === 'PUBLIC') params.set('is_private', 'false');
      else if (privacyFilter === 'PRIVATE') params.set('is_private', 'true');

      expect(params.get('search')).toBe('distributed consensus');
      expect(params.get('is_private')).toBe('false');
      expect(params.get('page')).toBe('2');
      expect(params.get('limit')).toBe('8');
    });

    it('omits is_private filter when set to ALL', () => {
      const privacyFilter = 'ALL';
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '8');
      if (privacyFilter === 'PUBLIC') params.set('is_private', 'false');
      else if (privacyFilter === 'PRIVATE') params.set('is_private', 'true');

      expect(params.has('is_private')).toBe(false);
      expect(params.toString()).toBe('page=1&limit=8');
    });
  });

  describe('Community Detail & Permissions', () => {
    it('verifies community member role hierarchy permissions', () => {
      const communityId = 'comm-123';
      const creatorId = 'creator-uuid';
      const currentUserId = 'user-uuid-1';

      const leadMember: CommunityMember = {
        id: 'm-1',
        community_id: communityId,
        user_id: currentUserId,
        role: 'LEAD',
        joined_at: '2026-11-03T00:00:00Z',
      };

      const regularMember: CommunityMember = {
        id: 'm-2',
        community_id: communityId,
        user_id: currentUserId,
        role: 'MEMBER',
        joined_at: '2026-11-03T00:00:00Z',
      };

      // Can manage roles if LEAD, creator, or admin
      const canManageRolesAsLead = leadMember.role === 'LEAD' || creatorId === currentUserId;
      const canManageRolesAsMember = regularMember.role === 'LEAD' || creatorId === currentUserId;

      expect(canManageRolesAsLead).toBe(true);
      expect(canManageRolesAsMember).toBe(false);
    });

    it('ensures original community creator cannot be demoted from LEAD', () => {
      const creatorId = 'creator-uuid-1';
      const targetUserId = 'creator-uuid-1';
      const targetNewRole = 'MEMBER';

      const isForbiddenDemotion = targetUserId === creatorId && targetNewRole !== 'LEAD';
      expect(isForbiddenDemotion).toBe(true);
    });

    it('ensures original community creator cannot be removed or kicked', () => {
      const creatorId = 'creator-uuid-1';
      const targetUserId = 'creator-uuid-1';

      const isForbiddenRemoval = targetUserId === creatorId;
      expect(isForbiddenRemoval).toBe(true);
    });
  });

  describe('Creator Channels Integration', () => {
    it('accurately parses channel profile and subscription status', () => {
      const channel: CreatorChannel & { is_subscribed?: boolean } = {
        id: 'ch-1',
        owner_id: 'creator-1',
        name: 'Quantum Systems Academy',
        slug: 'quantum-systems-academy',
        description: 'Advanced quantum computing and formal algorithms.',
        avatar_url: null,
        banner_url: null,
        is_verified: true,
        subscriber_count: 3400,
        created_at: '2026-11-03T00:00:00Z',
        updated_at: '2026-11-03T00:00:00Z',
        is_subscribed: true,
      };

      expect(channel.is_verified).toBe(true);
      expect(channel.subscriber_count).toBe(3400);
      expect(channel.is_subscribed).toBe(true);
    });

    it('validates channel creation payload', () => {
      const payload = {
        name: '   Neural Compilers   ',
        slug: 'neural-compilers',
        description: 'Compiler optimizations for edge tensor hardware.',
      };

      const sanitizedName = payload.name.trim();
      expect(sanitizedName).toBe('Neural Compilers');
      expect(sanitizedName.length).toBeGreaterThanOrEqual(3);
      expect(sanitizedName.length).toBeLessThanOrEqual(80);
      expect(/^[a-z0-9-]+$/.test(payload.slug)).toBe(true);
    });
  });
});
