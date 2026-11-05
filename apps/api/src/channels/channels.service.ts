import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CreateChannelDto } from './dto/create-channel.dto.js';
import type { UpdateChannelDto } from './dto/update-channel.dto.js';
import type { CreatorChannel, ChannelSubscriber, UserRole } from '@platform/types';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${randomSuffix}`.substring(0, 80);
  }

  /**
   * Retrieves creator channels (list or discovery).
   */
  async getChannels(
    search?: string,
    page = 1,
    limit = 20,
    ownerId?: string
  ): Promise<{ data: CreatorChannel[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const safeLimit = Math.min(limit || 20, 50);
    const from = (page - 1) * safeLimit;
    const to = from + safeLimit - 1;

    let q = client
      .from('creator_channels')
      .select('*, owner:owner_id(id, username, display_name, avatar_url, role, verification_status)', {
        count: 'exact',
      });

    if (ownerId) {
      q = q.eq('owner_id', ownerId);
    }

    if (search) {
      const searchTerms = search.trim().replace(/[^\w\s]/g, '');
      if (searchTerms) {
        q = q.or(`name.ilike.%${searchTerms}%,description.ilike.%${searchTerms}%`);
      }
    }

    q = q.order('subscriber_count', { ascending: false }).order('created_at', { ascending: false });

    const { data: channels, count, error } = await q.range(from, to);

    if (error) {
      this.logger.error(`Failed to get channels: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve channels.');
    }

    return {
      data: (channels || []) as CreatorChannel[],
      total: count || 0,
      page,
      limit: safeLimit,
    };
  }

  /**
   * Retrieves single channel profile by slug or UUID.
   */
  async getChannelBySlugOrId(
    slugOrId: string,
    currentUserId?: string
  ): Promise<CreatorChannel & { is_subscribed?: boolean }> {
    const client = this.databaseService.getClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    let q = client
      .from('creator_channels')
      .select('*, owner:owner_id(id, username, display_name, avatar_url, role, verification_status, headline)');

    if (isUuid) {
      q = q.eq('id', slugOrId);
    } else {
      q = q.eq('slug', slugOrId);
    }

    const { data: channel, error } = await q.maybeSingle();

    if (error || !channel) {
      throw new NotFoundException(`Channel '${slugOrId}' not found.`);
    }

    let isSubscribed = false;
    if (currentUserId) {
      const { data: sub } = await client
        .from('channel_subscribers')
        .select('id')
        .eq('channel_id', channel.id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      isSubscribed = !!sub;
    }

    return {
      ...(channel as CreatorChannel),
      is_subscribed: isSubscribed,
    };
  }

  /**
   * Creates a new creator channel. Only CREATOR, EDUCATOR, RESEARCHER, or ADMIN roles.
   */
  async createChannel(
    ownerId: string,
    userRole: UserRole,
    dto: CreateChannelDto
  ): Promise<CreatorChannel> {
    if (!['CREATOR', 'EDUCATOR', 'RESEARCHER', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Only creator, educator, or researcher accounts can establish broadcast channels.');
    }

    const client = this.databaseService.getClient();
    const slug = dto.slug?.trim() || this.generateSlug(dto.name);

    // Verify slug uniqueness
    const { data: existingSlug } = await client
      .from('creator_channels')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    // Never trust client for is_verified or subscriber_count
    const { data: channel, error: insertError } = await client
      .from('creator_channels')
      .insert({
        owner_id: ownerId,
        name: dto.name.trim(),
        slug: finalSlug,
        description: dto.description?.trim() || null,
        avatar_url: dto.avatar_url || null,
        banner_url: dto.banner_url || null,
        is_verified: false,
        subscriber_count: 0,
      })
      .select('*, owner:owner_id(id, username, display_name, avatar_url, role, verification_status)')
      .single();

    if (insertError || !channel) {
      this.logger.error(`Failed to create channel: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to create channel.');
    }

    return channel as CreatorChannel;
  }

  /**
   * Updates an existing creator channel. Owner or Platform Admin only.
   */
  async updateChannel(
    channelId: string,
    userId: string,
    userRole: UserRole,
    dto: UpdateChannelDto
  ): Promise<CreatorChannel> {
    const client = this.databaseService.getClient();

    const { data: existing, error: fetchError } = await client
      .from('creator_channels')
      .select('id, owner_id')
      .eq('id', channelId)
      .maybeSingle();

    if (fetchError || !existing) {
      throw new NotFoundException(`Channel with ID '${channelId}' not found.`);
    }

    if (existing.owner_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only the channel owner or a platform admin can update this channel.');
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (dto.avatar_url !== undefined) updates.avatar_url = dto.avatar_url || null;
    if (dto.banner_url !== undefined) updates.banner_url = dto.banner_url || null;

    const { data: updated, error: updateError } = await client
      .from('creator_channels')
      .update(updates)
      .eq('id', channelId)
      .select('*, owner:owner_id(id, username, display_name, avatar_url, role, verification_status)')
      .single();

    if (updateError || !updated) {
      this.logger.error(`Failed to update channel: ${updateError?.message}`);
      throw new InternalServerErrorException('Failed to update channel.');
    }

    return updated as CreatorChannel;
  }

  /**
   * Subscribes to a creator channel. Idempotent.
   */
  async subscribeChannel(channelId: string, userId: string): Promise<ChannelSubscriber> {
    const client = this.databaseService.getClient();

    const { data: channel, error: fetchError } = await client
      .from('creator_channels')
      .select('id, owner_id')
      .eq('id', channelId)
      .maybeSingle();

    if (fetchError || !channel) {
      throw new NotFoundException(`Channel with ID '${channelId}' not found.`);
    }

    // Check existing subscription
    const { data: existingSub } = await client
      .from('channel_subscribers')
      .select('*, profile:user_id(id, username, display_name, avatar_url, role)')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub) {
      return existingSub as ChannelSubscriber;
    }

    const { data: newSub, error: subError } = await client
      .from('channel_subscribers')
      .insert({
        channel_id: channelId,
        user_id: userId,
      })
      .select('*, profile:user_id(id, username, display_name, avatar_url, role)')
      .single();

    if (subError || !newSub) {
      this.logger.error(`Failed to subscribe: ${subError?.message}`);
      throw new InternalServerErrorException('Failed to subscribe to channel.');
    }

    return newSub as ChannelSubscriber;
  }

  /**
   * Unsubscribes from a creator channel. Idempotent.
   */
  async unsubscribeChannel(channelId: string, userId: string): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: channel } = await client
      .from('creator_channels')
      .select('id')
      .eq('id', channelId)
      .maybeSingle();

    if (!channel) {
      throw new NotFoundException(`Channel with ID '${channelId}' not found.`);
    }

    await client
      .from('channel_subscribers')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);
  }

  /**
   * Lists subscribers for a channel. Accessible to channel owner, platform admin,
   * or public subscribers list (privacy-redacted to basic profile).
   */
  async getSubscribers(
    channelId: string,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<ChannelSubscriber[]> {
    const client = this.databaseService.getClient();

    const { data: channel, error: fetchError } = await client
      .from('creator_channels')
      .select('id, owner_id')
      .eq('id', channelId)
      .maybeSingle();

    if (fetchError || !channel) {
      throw new NotFoundException(`Channel with ID '${channelId}' not found.`);
    }

    const { data: subscribers, error } = await client
      .from('channel_subscribers')
      .select('*, profile:user_id(id, username, display_name, avatar_url, role, verification_status)')
      .eq('channel_id', channelId)
      .order('subscribed_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get subscribers: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve subscribers.');
    }

    return (subscribers || []) as ChannelSubscriber[];
  }
}
