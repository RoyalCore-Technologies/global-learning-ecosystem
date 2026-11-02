import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { UserRole, type InteractionType } from '@platform/types';
import type { ToggleBookmarkDto } from './dto/toggle-bookmark.dto.js';
import type { Bookmark } from '@platform/types';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Toggles an interaction on an educational post.
   * STRICT ACADEMIC INTEGRITY RULE:
   * Only verified EDUCATOR, RESEARCHER, or ADMIN roles may grant ENDORSE_ACCURACY endorsements.
   */
  async toggleInteraction(
    userId: string,
    userRole: UserRole,
    postId: string,
    type: InteractionType
  ): Promise<{ isInteracted: boolean; type: InteractionType; currentCount: number }> {
    // 1. Verify Academic Endorsement Eligibility
    if (type === 'ENDORSE_ACCURACY') {
      const isEligible =
        userRole === UserRole.EDUCATOR ||
        userRole === UserRole.RESEARCHER ||
        userRole === UserRole.ADMIN;

      if (!isEligible) {
        throw new ForbiddenException(
          'Academic accuracy endorsements require verified EDUCATOR or RESEARCHER credentials.'
        );
      }
    }

    const client = this.databaseService.getClient();

    // 2. Verify target post exists and is published
    const { data: post, error: postErr } = await client
      .from('posts')
      .select('id, status, upvote_count')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      throw new NotFoundException('Knowledge post not found.');
    }

    // 3. Check existing interaction
    const { data: existingInteraction } = await client
      .from('interactions')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .eq('type', type)
      .maybeSingle();

    let isInteracted: boolean;

    if (existingInteraction) {
      // Toggle off (delete interaction)
      const { error: delErr } = await client
        .from('interactions')
        .delete()
        .eq('id', existingInteraction.id);

      if (delErr) {
        this.logger.error(`Failed to remove interaction: ${delErr.message}`);
        throw new InternalServerErrorException('Failed to remove interaction.');
      }
      isInteracted = false;
    } else {
      // Toggle on (insert interaction)
      const { error: insErr } = await client.from('interactions').insert({
        user_id: userId,
        post_id: postId,
        type,
      });

      if (insErr) {
        this.logger.error(`Failed to record interaction: ${insErr.message}`);
        throw new InternalServerErrorException('Failed to record interaction.');
      }
      isInteracted = true;
    }

    // 4. Fetch updated interaction counter
    const { count } = await client
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('type', type);

    return {
      isInteracted,
      type,
      currentCount: count || 0,
    };
  }

  /**
   * Toggles bookmarking for an educational post in the user's reading list.
   */
  async toggleBookmark(
    userId: string,
    postId: string,
    dto: ToggleBookmarkDto
  ): Promise<{ isBookmarked: boolean }> {
    const client = this.databaseService.getClient();

    // 1. Verify post exists
    const { data: post, error: postErr } = await client
      .from('posts')
      .select('id')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      throw new NotFoundException('Knowledge post not found.');
    }

    // 2. Check existing bookmark
    const { data: existingBookmark } = await client
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (existingBookmark) {
      // Remove bookmark
      const { error: delErr } = await client
        .from('bookmarks')
        .delete()
        .eq('id', existingBookmark.id);

      if (delErr) {
        throw new InternalServerErrorException('Failed to remove bookmark.');
      }
      return { isBookmarked: false };
    }

    // Add bookmark
    const { error: insErr } = await client.from('bookmarks').insert({
      user_id: userId,
      post_id: postId,
      collection_name: dto.collection_name?.trim() || 'Reading List',
      notes: dto.notes?.trim() || null,
    });

    if (insErr) {
      throw new InternalServerErrorException('Failed to save bookmark.');
    }

    return { isBookmarked: true };
  }

  /**
   * Retrieves the current user's saved reading list items.
   */
  async getUserBookmarks(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Bookmark[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: bookmarks, count, error } = await client
      .from('bookmarks')
      .select(
        '*, post:post_id(*, author:author_id(id, username, display_name, avatar_url, role, verification_status, headline))',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to retrieve bookmarks: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve reading list.');
    }

    return {
      data: (bookmarks || []) as Bookmark[],
      total: count || 0,
      page,
      limit,
    };
  }
}
