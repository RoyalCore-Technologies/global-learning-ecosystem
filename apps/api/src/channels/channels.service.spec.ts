import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelsService } from './channels.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@platform/types';

describe('ChannelsService', () => {
  let service: ChannelsService;
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

    service = new ChannelsService(mockDatabaseService);
  });

  describe('getChannels & getChannelBySlugOrId', () => {
    it('returns channel catalog ordered by subscriber count', async () => {
      const mockChannels = [
        { id: 'ch-1', name: 'AI Research Lab', subscriber_count: 5000 },
        { id: 'ch-2', name: 'Rust Core', subscriber_count: 3200 },
      ];

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: mockChannels, error: null, count: 2 });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getChannels();
      expect(result.data).toHaveLength(2);
      expect(result.data[0].subscriber_count).toBe(5000);
    });

    it('filters channel catalog by owner_id when provided', async () => {
      const mockChannels = [
        { id: 'ch-1', name: 'AI Research Lab', owner_id: 'scholar-1', subscriber_count: 5000 },
      ];

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: mockChannels, error: null, count: 1 });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getChannels(undefined, 1, 20, 'scholar-1');
      expect(chain.eq).toHaveBeenCalledWith('owner_id', 'scholar-1');
      expect(result.data).toHaveLength(1);
    });

    it('returns single channel with subscription status for authenticated user', async () => {
      const mockChannel = {
        id: 'ch-1',
        name: 'AI Research Lab',
        slug: 'ai-research-lab',
        subscriber_count: 5000,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_channels') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockChannel, error: null }),
          };
        }
        if (table === 'channel_subscribers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'sub-1' }, error: null }),
          };
        }
        return {};
      });

      const res = await service.getChannelBySlugOrId('ai-research-lab', 'user-subscriber-1');
      expect(res.id).toBe(mockChannel.id);
      expect(res.is_subscribed).toBe(true);
    });
  });

  describe('createChannel', () => {
    it('allows CREATOR or EDUCATOR to establish channel', async () => {
      const mockCreated = {
        id: 'ch-new',
        owner_id: 'creator-1',
        name: 'Distributed Systems',
        slug: 'distributed-systems',
        subscriber_count: 0,
        is_verified: false,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
      });

      const res = await service.createChannel('creator-1', 'CREATOR' as UserRole, {
        name: 'Distributed Systems',
      });
      expect(res.name).toBe('Distributed Systems');
      expect(res.is_verified).toBe(false);
    });

    it('blocks regular STUDENT from creating channel', async () => {
      await expect(
        service.createChannel('student-1', 'STUDENT' as UserRole, {
          name: 'Hacker Channel',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateChannel', () => {
    it('allows channel owner to update profile', async () => {
      const existing = { id: 'ch-1', owner_id: 'owner-1' };
      const updated = { id: 'ch-1', name: 'Updated Channel', owner_id: 'owner-1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updated, error: null }),
      });

      const res = await service.updateChannel('ch-1', 'owner-1', 'CREATOR' as UserRole, {
        name: 'Updated Channel',
      });
      expect(res.name).toBe('Updated Channel');
    });

    it('blocks non-owner from updating channel', async () => {
      const existing = { id: 'ch-1', owner_id: 'owner-1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existing }),
      });

      await expect(
        service.updateChannel('ch-1', 'hacker-2', 'CREATOR' as UserRole, {
          name: 'Hijacked Channel',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('subscribe & unsubscribe (Idempotent)', () => {
    it('subscribes user and returns subscriber record', async () => {
      const channel = { id: 'ch-1', owner_id: 'owner-1' };
      const newSub = { id: 'sub-1', channel_id: 'ch-1', user_id: 'student-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_channels') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: channel }),
          };
        }
        if (table === 'channel_subscribers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: newSub, error: null }),
          };
        }
        return {};
      });

      const res = await service.subscribeChannel('ch-1', 'student-1');
      expect(res.id).toBe(newSub.id);
    });

    it('returns existing subscription idempotently', async () => {
      const channel = { id: 'ch-1', owner_id: 'owner-1' };
      const existingSub = { id: 'sub-existing', channel_id: 'ch-1', user_id: 'student-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_channels') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: channel }),
          };
        }
        if (table === 'channel_subscribers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingSub }),
          };
        }
        return {};
      });

      const res = await service.subscribeChannel('ch-1', 'student-1');
      expect(res.id).toBe('sub-existing');
    });

    it('unsubscribes user idempotently', async () => {
      const channel = { id: 'ch-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_channels') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: channel }),
          };
        }
        if (table === 'channel_subscribers') {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      await expect(service.unsubscribeChannel('ch-1', 'student-1')).resolves.not.toThrow();
    });
  });
});
