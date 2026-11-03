import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommunitiesService } from './communities.service.js';
import { CommunityQueryDto } from './dto/community-query.dto.js';
import { CreateCommunityDto } from './dto/create-community.dto.js';
import { UpdateCommunityDto } from './dto/update-community.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Communities & Subject Clubs')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Public discovery for communities with search and privacy filtering' })
  @ApiResponse({ status: 200, description: 'Communities list retrieved successfully' })
  async getCommunities(
    @Query() query: CommunityQueryDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const result = await this.communitiesService.getCommunities(
      query,
      user?.id,
      user?.role as UserRole
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get(':slugOrId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get community details by unique slug or UUID' })
  @ApiResponse({ status: 200, description: 'Community retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: private community access restricted' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async getCommunityBySlugOrId(
    @Param('slugOrId') slugOrId: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const data = await this.communitiesService.getCommunityBySlugOrId(
      slugOrId,
      user?.id,
      user?.role as UserRole
    );
    return {
      success: true,
      data,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new community' })
  @ApiResponse({ status: 201, description: 'Community created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCommunity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityDto
  ) {
    const community = await this.communitiesService.createCommunity(user.id, dto);
    return {
      success: true,
      data: community,
      message: 'Community created successfully.',
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update community settings (Creator or Platform Admin only)' })
  @ApiResponse({ status: 200, description: 'Community updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: ownership required' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async updateCommunity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommunityDto
  ) {
    const updated = await this.communitiesService.updateCommunity(
      id,
      user.id,
      user.role as UserRole,
      dto
    );
    return {
      success: true,
      data: updated,
      message: 'Community settings updated successfully.',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete community (Creator or Platform Admin only)' })
  @ApiResponse({ status: 200, description: 'Community deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: ownership required' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async deleteCommunity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.communitiesService.deleteCommunity(
      id,
      user.id,
      user.role as UserRole
    );
    return {
      success: true,
      message: 'Community deleted successfully.',
    };
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Join a community (idempotent)' })
  @ApiResponse({ status: 200, description: 'Successfully joined community' })
  @ApiResponse({ status: 403, description: 'Forbidden: private community' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async joinCommunity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const member = await this.communitiesService.joinCommunity(
      id,
      user.id,
      user.role as UserRole
    );
    return {
      success: true,
      data: member,
      message: 'Successfully joined community.',
    };
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Leave a community (idempotent)' })
  @ApiResponse({ status: 200, description: 'Successfully left community' })
  @ApiResponse({ status: 400, description: 'Creator must transfer ownership before leaving' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async leaveCommunity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.communitiesService.leaveCommunity(id, user.id);
    return {
      success: true,
      message: 'Successfully left community.',
    };
  }

  @Get(':id/members')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List members of a community' })
  @ApiResponse({ status: 200, description: 'Community members retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: private community members access' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const members = await this.communitiesService.getMembers(
      id,
      user?.id,
      user?.role as UserRole
    );
    return {
      success: true,
      data: members,
    };
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a member role (Community LEAD, creator, or Platform Admin only)' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot demote creator' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto
  ) {
    const member = await this.communitiesService.updateMemberRole(
      id,
      userId,
      user.id,
      user.role as UserRole,
      dto
    );
    return {
      success: true,
      data: member,
      message: 'Community member role updated successfully.',
    };
  }
}
