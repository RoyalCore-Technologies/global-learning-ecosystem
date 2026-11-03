import { describe, it, expect } from 'vitest';
import {
  CommunityRole,
  Community,
  CommunityMember,
  CreatorChannel,
  ChannelSubscriber
} from './index.js';

describe('Creator & Community Shared Types (M4.2)', () => {
  it('validates CommunityRole assignments', () => {
    const roles: CommunityRole[] = ['MEMBER', 'MODERATOR', 'LEAD'];
    expect(roles).toHaveLength(3);
  });

  it('verifies Community object typing matches database schema contracts', () => {
    const sampleCommunity: Community = {
      id: 'c1111111-1111-1111-1111-111111111111',
      creator_id: 'u1111111-1111-1111-1111-111111111111',
      name: 'Full Stack AI Builders',
      slug: 'full-stack-ai-builders',
      description: 'A global guild of developers creating next-gen intelligent tools.',
      avatar_url: 'https://cdn.learnova.edu/avatars/fullstackai.png',
      banner_url: 'https://cdn.learnova.edu/banners/fullstackai.png',
      is_private: false,
      member_count: 42,
      created_at: '2026-11-03T00:00:00.000Z',
      updated_at: '2026-11-03T00:00:00.000Z'
    };

    expect(sampleCommunity.name).toBe('Full Stack AI Builders');
    expect(sampleCommunity.member_count).toBe(42);
    expect(sampleCommunity.is_private).toBe(false);
  });

  it('verifies CommunityMember relationship typing', () => {
    const sampleMember: CommunityMember = {
      id: 'm1111111-1111-1111-1111-111111111111',
      community_id: 'c1111111-1111-1111-1111-111111111111',
      user_id: 'u1111111-1111-1111-1111-111111111111',
      role: 'LEAD',
      joined_at: '2026-11-03T00:00:00.000Z'
    };

    expect(sampleMember.role).toBe('LEAD');
    expect(sampleMember.community_id).toBeDefined();
  });

  it('verifies CreatorChannel and ChannelSubscriber typing', () => {
    const channel: CreatorChannel = {
      id: 'ch11111-1111-1111-1111-111111111111',
      owner_id: 'u1111111-1111-1111-1111-111111111111',
      name: 'System Architecture Academy',
      slug: 'system-architecture-academy',
      description: 'Deep dives into microservices, event streams, and reactive UX.',
      avatar_url: null,
      banner_url: null,
      is_verified: true,
      subscriber_count: 1250,
      created_at: '2026-11-03T00:00:00.000Z',
      updated_at: '2026-11-03T00:00:00.000Z'
    };

    const subscriber: ChannelSubscriber = {
      id: 'sub1111-1111-1111-1111-111111111111',
      channel_id: channel.id,
      user_id: 'u2222222-2222-2222-2222-222222222222',
      subscribed_at: '2026-11-03T00:00:00.000Z'
    };

    expect(channel.is_verified).toBe(true);
    expect(channel.subscriber_count).toBe(1250);
    expect(subscriber.channel_id).toBe(channel.id);
  });
});
