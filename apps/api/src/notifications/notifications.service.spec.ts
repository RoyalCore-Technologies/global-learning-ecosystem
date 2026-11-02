import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
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

    service = new NotificationsService(mockDatabaseService);
  });

  describe('getUserNotifications', () => {
    it('retrieves user notifications and calculates unread count', async () => {
      const mockNotifs = [
        { id: 'n-1', recipient_id: 'user-1', is_read: false, title: 'New comment' },
        { id: 'n-2', recipient_id: 'user-1', is_read: true, title: 'New follower' },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: any) => {
                return {
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({ data: mockNotifs, count: 2, error: null }),
                  }),
                  eq: vi.fn().mockReturnValue({
                    count: 1,
                  }),
                };
              }),
            }),
          };
        }
        return {};
      });

      const res = await service.getUserNotifications('user-1');
      expect(res.data.length).toBe(2);
      expect(res.total).toBe(2);
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read when user is recipient', async () => {
      const notification = { id: 'n-1', recipient_id: 'user-1' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: notification, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const res = await service.markAsRead('n-1', 'user-1');
      expect(res.success).toBe(true);
    });

    it('throws ForbiddenException when user is not the recipient', async () => {
      const notification = { id: 'n-1', recipient_id: 'other-user' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: notification, error: null }),
          }),
        }),
      });

      await expect(service.markAsRead('n-1', 'intruder')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(service.markAsRead('unknown-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePreferences', () => {
    it('merges and updates user notification preferences', async () => {
      const existingProfile = {
        notification_preferences: {
          in_app: { comments: true, upvotes: true, endorsements: true, follows: true, system: true },
          email: { weekly_digest: true, major_announcements: true },
        },
      };

      const updatedPrefs = {
        in_app: { comments: false, upvotes: true, endorsements: true, follows: true, system: true },
        email: { weekly_digest: true, major_announcements: true },
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingProfile, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { notification_preferences: updatedPrefs },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await service.updatePreferences('user-1', {
        in_app: { comments: false },
      });

      expect(res.in_app.comments).toBe(false);
      expect(res.in_app.endorsements).toBe(true);
    });
  });
});
