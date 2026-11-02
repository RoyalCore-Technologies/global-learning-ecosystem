import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { Notification, NotificationPreferences } from '@platform/types';
import type { NotificationPreferencesDto } from '../profiles/dto/update-profile.dto.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves paginated in-app notifications for the authenticated user, along with unread count.
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const client = this.databaseService.getClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const [listRes, unreadRes] = await Promise.all([
      client
        .from('notifications')
        .select('*, actor:actor_id(id, username, display_name, avatar_url)', { count: 'exact' })
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to),
      client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false),
    ]);

    if (listRes.error) {
      this.logger.error(`Failed to fetch notifications: ${listRes.error.message}`);
      throw new InternalServerErrorException('Failed to retrieve notifications.');
    }

    return {
      data: (listRes.data || []) as Notification[],
      total: listRes.count || 0,
      unreadCount: unreadRes.count || 0,
      page,
      limit,
    };
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<{ success: boolean }> {
    const client = this.databaseService.getClient();

    const { data: notification, error: findErr } = await client
      .from('notifications')
      .select('id, recipient_id')
      .eq('id', notificationId)
      .single();

    if (findErr || !notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.recipient_id !== userId) {
      throw new ForbiddenException('You do not have access to this notification.');
    }

    const { error: updateErr } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (updateErr) {
      throw new InternalServerErrorException('Failed to mark notification as read.');
    }

    return { success: true };
  }

  /**
   * Marks all unread notifications for the user as read.
   */
  async markAllAsRead(userId: string): Promise<{ markedCount: number }> {
    const client = this.databaseService.getClient();

    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      this.logger.error(`Failed to mark all notifications as read: ${error.message}`);
      throw new InternalServerErrorException('Failed to clear unread notifications.');
    }

    return { markedCount: data?.length || 0 };
  }

  /**
   * Retrieves notification preferences from the user profile.
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const client = this.databaseService.getClient();

    const { data: profile, error } = await client
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('User profile not found.');
    }

    return profile.notification_preferences as NotificationPreferences;
  }

  /**
   * Updates notification preferences in the user profile.
   */
  async updatePreferences(
    userId: string,
    dto: NotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    const client = this.databaseService.getClient();

    const { data: profile, error: fetchErr } = await client
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (fetchErr || !profile) {
      throw new NotFoundException('User profile not found.');
    }

    const currentPrefs = (profile.notification_preferences || {}) as any;
    const mergedPrefs: NotificationPreferences = {
      in_app: {
        comments: dto.in_app?.comments ?? currentPrefs.in_app?.comments ?? true,
        upvotes: dto.in_app?.upvotes ?? currentPrefs.in_app?.upvotes ?? true,
        endorsements: dto.in_app?.endorsements ?? currentPrefs.in_app?.endorsements ?? true,
        follows: dto.in_app?.follows ?? currentPrefs.in_app?.follows ?? true,
        system: dto.in_app?.system ?? currentPrefs.in_app?.system ?? true,
      },
      email: {
        weekly_digest: dto.email?.weekly_digest ?? currentPrefs.email?.weekly_digest ?? true,
        major_announcements:
          dto.email?.major_announcements ?? currentPrefs.email?.major_announcements ?? true,
      },
    };

    const { data: updated, error: updateErr } = await client
      .from('profiles')
      .update({ notification_preferences: mergedPrefs })
      .eq('id', userId)
      .select('notification_preferences')
      .single();

    if (updateErr || !updated) {
      throw new InternalServerErrorException('Failed to update notification preferences.');
    }

    return updated.notification_preferences as NotificationPreferences;
  }
}
