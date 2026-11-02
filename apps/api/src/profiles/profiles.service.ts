import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { Profile } from '@platform/types';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves a public user profile by username, including follower/following counts,
   * published posts count, and follow relationship status.
   */
  async getProfileByUsername(username: string, currentUserId?: string): Promise<Profile & { is_following?: boolean }> {
    const client = this.databaseService.getClient();

    const { data: profile, error } = await client
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, headline, bio, role, verification_status, skills, github_url, linkedin_url, website_url, is_banned, created_at, updated_at'
      )
      .eq('username', username)
      .single();

    if (error || !profile) {
      throw new NotFoundException(`User profile with username '${username}' was not found.`);
    }

    if (profile.is_banned) {
      throw new NotFoundException(`This account is no longer available.`);
    }

    // Aggregate counts
    const [followersRes, followingRes, postsRes] = await Promise.all([
      client.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
      client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
      client.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', profile.id).eq('status', 'PUBLISHED'),
    ]);

    let isFollowing = false;
    if (currentUserId && currentUserId !== profile.id) {
      const { data: followRel } = await client
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)
        .maybeSingle();

      isFollowing = !!followRel;
    }

    return {
      ...profile,
      follower_count: followersRes.count || 0,
      following_count: followingRes.count || 0,
      posts_count: postsRes.count || 0,
      is_following: isFollowing,
    } as Profile & { is_following?: boolean };
  }

  /**
   * Retrieves the authenticated user's private profile, including notification preferences.
   */
  async getMyProfile(userId: string): Promise<Profile> {
    const client = this.databaseService.getClient();

    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('Profile record not found for the current user.');
    }

    return profile as Profile;
  }

  /**
   * Updates the profile of the current authenticated user.
   * Modifying roles is strictly forbidden through this endpoint.
   */
  async updateMyProfile(userId: string, updateDto: UpdateProfileDto): Promise<Profile> {
    const client = this.databaseService.getClient();

    // Whitelist only editable fields to prevent any accidental payload injection
    const payload: Record<string, unknown> = {};
    if (updateDto.display_name !== undefined) payload.display_name = updateDto.display_name;
    if (updateDto.headline !== undefined) payload.headline = updateDto.headline;
    if (updateDto.bio !== undefined) payload.bio = updateDto.bio;
    if (updateDto.skills !== undefined) payload.skills = updateDto.skills;
    if (updateDto.github_url !== undefined) payload.github_url = updateDto.github_url;
    if (updateDto.linkedin_url !== undefined) payload.linkedin_url = updateDto.linkedin_url;
    if (updateDto.website_url !== undefined) payload.website_url = updateDto.website_url;
    if (updateDto.notification_preferences !== undefined) {
      payload.notification_preferences = updateDto.notification_preferences;
    }

    const { data: updatedProfile, error } = await client
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update profile for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update user profile.');
    }

    return updatedProfile as Profile;
  }

  /**
   * Toggles following status for another user.
   * Enforces self-follow prohibition (chk_no_self_follow).
   */
  async toggleFollow(
    followerId: string,
    targetUserId: string
  ): Promise<{ isFollowing: boolean; followerCount: number }> {
    if (followerId === targetUserId) {
      throw new BadRequestException('Scholars cannot follow themselves.');
    }

    const client = this.databaseService.getClient();

    // Verify target user exists
    const { data: targetProfile, error: targetErr } = await client
      .from('profiles')
      .select('id, is_banned')
      .eq('id', targetUserId)
      .single();

    if (targetErr || !targetProfile) {
      throw new NotFoundException('The target profile to follow does not exist.');
    }

    if (targetProfile.is_banned) {
      throw new BadRequestException('Cannot follow a deactivated or banned account.');
    }

    // Check existing follow relationship
    const { data: existingFollow } = await client
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    let isFollowing: boolean;

    if (existingFollow) {
      // Unfollow
      const { error: deleteErr } = await client
        .from('follows')
        .delete()
        .eq('id', existingFollow.id);

      if (deleteErr) {
        throw new InternalServerErrorException('Failed to unfollow user.');
      }
      isFollowing = false;
    } else {
      // Follow
      const { error: insertErr } = await client.from('follows').insert({
        follower_id: followerId,
        following_id: targetUserId,
      });

      if (insertErr) {
        throw new InternalServerErrorException('Failed to follow user.');
      }
      isFollowing = true;
    }

    // Fetch updated follower count for target user
    const { count } = await client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    return {
      isFollowing,
      followerCount: count || 0,
    };
  }

  /**
   * Retrieves paginated followers for a specified user.
   */
  async getFollowers(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Profile[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: followRecords, count, error } = await client
      .from('follows')
      .select('follower:follower_id(id, username, display_name, avatar_url, role, verification_status, headline)', {
        count: 'exact',
      })
      .eq('following_id', userId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to retrieve followers list.');
    }

    const profiles = (followRecords || [])
      .map((item: any) => item.follower)
      .filter(Boolean);

    return {
      data: profiles,
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Retrieves paginated following list for a specified user.
   */
  async getFollowing(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Profile[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: followingRecords, count, error } = await client
      .from('follows')
      .select('following:following_id(id, username, display_name, avatar_url, role, verification_status, headline)', {
        count: 'exact',
      })
      .eq('follower_id', userId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to retrieve following list.');
    }

    const profiles = (followingRecords || [])
      .map((item: any) => item.following)
      .filter(Boolean);

    return {
      data: profiles,
      total: count || 0,
      page,
      limit,
    };
  }
}
