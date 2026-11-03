import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CommunityQueryDto } from './dto/community-query.dto.js';
import type { CreateCommunityDto } from './dto/create-community.dto.js';
import type { UpdateCommunityDto } from './dto/update-community.dto.js';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import type { Community, CommunityMember, CommunityRole, UserRole } from '@platform/types';

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name);

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
   * Public discovery for communities with search, privacy filters, and pagination.
   */
  async getCommunities(
    query: CommunityQueryDto,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<{ data: Community[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = client
      .from('communities')
      .select('*, creator:creator_id(id, username, display_name, avatar_url, role, verification_status)', {
        count: 'exact',
      });

    // Handle privacy filter
    if (currentUserRole === 'ADMIN') {
      // Platform admin can see all communities regardless of privacy
      if (query.is_private !== undefined) {
        q = q.eq('is_private', query.is_private);
      }
    } else if (currentUserId) {
      // Authenticated users: if is_private is explicitly requested, allow their joined private ones or their created ones
      if (query.is_private === false) {
        q = q.eq('is_private', false);
      } else if (query.is_private === true) {
        // Find private communities user is creator of or member of
        const { data: memberRecords } = await client
          .from('community_members')
          .select('community_id')
          .eq('user_id', currentUserId);

        const joinedIds = (memberRecords || []).map((m) => m.community_id);
        const { data: createdRecords } = await client
          .from('communities')
          .select('id')
          .eq('creator_id', currentUserId)
          .eq('is_private', true);

        const createdIds = (createdRecords || []).map((c) => c.id);
        const accessiblePrivateIds = Array.from(new Set([...joinedIds, ...createdIds]));

        if (accessiblePrivateIds.length === 0) {
          return { data: [], total: 0, page, limit };
        }
        q = q.eq('is_private', true).in('id', accessiblePrivateIds);
      } else {
        // By default on public explore, show public communities
        q = q.eq('is_private', false);
      }
    } else {
      // Unauthenticated visitors only see public communities
      q = q.eq('is_private', false);
    }

    if (query.search) {
      const searchTerms = query.search.trim().replace(/[^\w\s]/g, '');
      if (searchTerms) {
        q = q.or(`name.ilike.%${searchTerms}%,description.ilike.%${searchTerms}%`);
      }
    }

    q = q.order('member_count', { ascending: false }).order('created_at', { ascending: false });

    const { data: communities, count, error } = await q.range(from, to);

    if (error) {
      this.logger.error(`Failed to get communities: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve communities.');
    }

    return {
      data: (communities || []) as Community[],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Retrieves single community by slug or UUID with privacy checks.
   */
  async getCommunityBySlugOrId(
    slugOrId: string,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<Community & { user_membership?: { role: CommunityRole; joined_at: string } | null }> {
    const client = this.databaseService.getClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    let q = client
      .from('communities')
      .select('*, creator:creator_id(id, username, display_name, avatar_url, role, verification_status)');

    if (isUuid) {
      q = q.eq('id', slugOrId);
    } else {
      q = q.eq('slug', slugOrId);
    }

    const { data: community, error } = await q.maybeSingle();

    if (error || !community) {
      throw new NotFoundException(`Community '${slugOrId}' not found.`);
    }

    let userMembership: { role: CommunityRole; joined_at: string } | null = null;

    if (currentUserId) {
      const { data: membership } = await client
        .from('community_members')
        .select('role, joined_at')
        .eq('community_id', community.id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (membership) {
        userMembership = {
          role: membership.role as CommunityRole,
          joined_at: membership.joined_at,
        };
      }
    }

    // Access control for private communities
    if (community.is_private) {
      const isCreator = currentUserId === community.creator_id;
      const isAdmin = currentUserRole === 'ADMIN';
      const isMember = !!userMembership;

      if (!isCreator && !isAdmin && !isMember) {
        throw new ForbiddenException('This is a private community. You must be an approved member to view details.');
      }
    }

    return {
      ...(community as Community),
      user_membership: userMembership,
    };
  }

  /**
   * Creates a new community. The creator is automatically added as LEAD member.
   */
  async createCommunity(creatorId: string, dto: CreateCommunityDto): Promise<Community> {
    const client = this.databaseService.getClient();

    const slug = dto.slug?.trim() || this.generateSlug(dto.name);

    // Verify slug uniqueness
    const { data: existingSlug } = await client
      .from('communities')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    // Start by inserting community with member_count = 0 (trigger will increment to 1 on initial member insert)
    const { data: community, error: insertError } = await client
      .from('communities')
      .insert({
        creator_id: creatorId,
        name: dto.name.trim(),
        slug: finalSlug,
        description: dto.description?.trim() || null,
        avatar_url: dto.avatar_url || null,
        banner_url: dto.banner_url || null,
        is_private: dto.is_private ?? false,
        member_count: 0,
      })
      .select('*, creator:creator_id(id, username, display_name, avatar_url, role, verification_status)')
      .single();

    if (insertError || !community) {
      this.logger.error(`Failed to create community: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to create community.');
    }

    // Add creator as LEAD member
    await client.from('community_members').insert({
      community_id: community.id,
      user_id: creatorId,
      role: 'LEAD',
    });

    // Re-fetch community with updated member_count
    const { data: updatedCommunity } = await client
      .from('communities')
      .select('*, creator:creator_id(id, username, display_name, avatar_url, role, verification_status)')
      .eq('id', community.id)
      .single();

    return (updatedCommunity || community) as Community;
  }

  /**
   * Updates an existing community. Creator or Platform Admin only.
   */
  async updateCommunity(
    communityId: string,
    userId: string,
    userRole: UserRole,
    dto: UpdateCommunityDto
  ): Promise<Community> {
    const client = this.databaseService.getClient();

    const { data: existing, error: fetchError } = await client
      .from('communities')
      .select('id, creator_id')
      .eq('id', communityId)
      .maybeSingle();

    if (fetchError || !existing) {
      throw new NotFoundException(`Community with ID '${communityId}' not found.`);
    }

    if (existing.creator_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only the community creator or a platform admin can update settings.');
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (dto.avatar_url !== undefined) updates.avatar_url = dto.avatar_url || null;
    if (dto.banner_url !== undefined) updates.banner_url = dto.banner_url || null;
    if (dto.is_private !== undefined) updates.is_private = dto.is_private;

    const { data: updated, error: updateError } = await client
      .from('communities')
      .update(updates)
      .eq('id', communityId)
      .select('*, creator:creator_id(id, username, display_name, avatar_url, role, verification_status)')
      .single();

    if (updateError || !updated) {
      this.logger.error(`Failed to update community: ${updateError?.message}`);
      throw new InternalServerErrorException('Failed to update community.');
    }

    return updated as Community;
  }

  /**
   * Deletes a community. Creator or Platform Admin only.
   */
  async deleteCommunity(communityId: string, userId: string, userRole: UserRole): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: existing, error: fetchError } = await client
      .from('communities')
      .select('id, creator_id')
      .eq('id', communityId)
      .maybeSingle();

    if (fetchError || !existing) {
      throw new NotFoundException(`Community with ID '${communityId}' not found.`);
    }

    if (existing.creator_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only the community creator or a platform admin can delete this community.');
    }

    const { error: deleteError } = await client
      .from('communities')
      .delete()
      .eq('id', communityId);

    if (deleteError) {
      this.logger.error(`Failed to delete community: ${deleteError.message}`);
      throw new InternalServerErrorException('Failed to delete community.');
    }
  }

  /**
   * Joins a public community. Idempotent.
   */
  async joinCommunity(communityId: string, userId: string, userRole: UserRole): Promise<CommunityMember> {
    const client = this.databaseService.getClient();

    const { data: community, error: fetchError } = await client
      .from('communities')
      .select('id, is_private, creator_id')
      .eq('id', communityId)
      .maybeSingle();

    if (fetchError || !community) {
      throw new NotFoundException(`Community with ID '${communityId}' not found.`);
    }

    // Check existing membership
    const { data: existingMember } = await client
      .from('community_members')
      .select('*, profile:user_id(id, username, display_name, avatar_url, role)')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return existingMember as CommunityMember;
    }

    // Direct joining of private communities is forbidden unless creator or admin
    if (community.is_private && community.creator_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot directly join a private community without an invitation or approval.');
    }

    const { data: newMember, error: joinError } = await client
      .from('community_members')
      .insert({
        community_id: communityId,
        user_id: userId,
        role: 'MEMBER',
      })
      .select('*, profile:user_id(id, username, display_name, avatar_url, role)')
      .single();

    if (joinError || !newMember) {
      this.logger.error(`Failed to join community: ${joinError?.message}`);
      throw new InternalServerErrorException('Failed to join community.');
    }

    return newMember as CommunityMember;
  }

  /**
   * Leaves a community. Idempotent.
   */
  async leaveCommunity(communityId: string, userId: string): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: community } = await client
      .from('communities')
      .select('id, creator_id')
      .eq('id', communityId)
      .maybeSingle();

    if (!community) {
      throw new NotFoundException(`Community with ID '${communityId}' not found.`);
    }

    // If creator is the only LEAD, prevent leaving without transferring ownership
    if (community.creator_id === userId) {
      const { data: otherLeads } = await client
        .from('community_members')
        .select('id')
        .eq('community_id', communityId)
        .eq('role', 'LEAD')
        .neq('user_id', userId);

      if (!otherLeads || otherLeads.length === 0) {
        throw new BadRequestException('Community creator cannot leave without appointing another LEAD or deleting the community.');
      }
    }

    await client
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', userId);
  }

  /**
   * Lists community members with role details.
   */
  async getMembers(
    communityId: string,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<CommunityMember[]> {
    const client = this.databaseService.getClient();

    const { data: community, error: commError } = await client
      .from('communities')
      .select('id, is_private, creator_id')
      .eq('id', communityId)
      .maybeSingle();

    if (commError || !community) {
      throw new NotFoundException(`Community with ID '${communityId}' not found.`);
    }

    if (community.is_private) {
      // Must verify membership if private
      let authorized = false;
      if (currentUserRole === 'ADMIN' || currentUserId === community.creator_id) {
        authorized = true;
      } else if (currentUserId) {
        const { data: membership } = await client
          .from('community_members')
          .select('id')
          .eq('community_id', communityId)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (membership) authorized = true;
      }

      if (!authorized) {
        throw new ForbiddenException('Private community member lists are accessible only to community members.');
      }
    }

    const { data: members, error } = await client
      .from('community_members')
      .select('*, profile:user_id(id, username, display_name, avatar_url, role, verification_status, headline)')
      .eq('community_id', communityId)
      .order('joined_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get community members: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve community members.');
    }

    return (members || []) as CommunityMember[];
  }

  /**
   * Updates a community member's role (LEAD, creator, or platform admin only).
   */
  async updateMemberRole(
    communityId: string,
    targetUserId: string,
    actingUserId: string,
    actingUserRole: UserRole,
    dto: UpdateMemberRoleDto
  ): Promise<CommunityMember> {
    const client = this.databaseService.getClient();

    const { data: community, error: commError } = await client
      .from('communities')
      .select('id, creator_id')
      .eq('id', communityId)
      .maybeSingle();

    if (commError || !community) {
      throw new NotFoundException(`Community with ID '${communityId}' not found.`);
    }

    // Check acting user's permissions
    const isCreator = community.creator_id === actingUserId;
    const isAdmin = actingUserRole === 'ADMIN';

    let isLead = false;
    if (!isCreator && !isAdmin) {
      const { data: actingMember } = await client
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', actingUserId)
        .maybeSingle();

      if (actingMember?.role === 'LEAD') {
        isLead = true;
      }
    }

    if (!isCreator && !isAdmin && !isLead) {
      throw new ForbiddenException('Only community leaders, the creator, or platform admins can manage member roles.');
    }

    // Cannot demote creator
    if (community.creator_id === targetUserId && dto.role !== 'LEAD') {
      throw new BadRequestException('The original community creator cannot be demoted from LEAD role.');
    }

    const { data: updatedMember, error: updateError } = await client
      .from('community_members')
      .update({ role: dto.role })
      .eq('community_id', communityId)
      .eq('user_id', targetUserId)
      .select('*, profile:user_id(id, username, display_name, avatar_url, role)')
      .single();

    if (updateError || !updatedMember) {
      throw new NotFoundException(`Member record for user '${targetUserId}' not found in this community.`);
    }

    return updatedMember as CommunityMember;
  }
}
