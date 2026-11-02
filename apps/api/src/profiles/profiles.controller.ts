import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('Profiles & Social Graph')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile including notification preferences' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.profilesService.getMyProfile(user.id);
    return {
      success: true,
      data: profile,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user profile and preferences' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateDto: UpdateProfileDto
  ) {
    const updated = await this.profilesService.updateMyProfile(user.id, updateDto);
    return {
      success: true,
      data: updated,
      message: 'Profile updated successfully.',
    };
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get public user profile by username' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User profile not found' })
  async getProfileByUsername(
    @Param('username') username: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const profile = await this.profilesService.getProfileByUsername(username, user?.id);
    return {
      success: true,
      data: profile,
    };
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle follow/unfollow for another scholar' })
  @ApiResponse({ status: 200, description: 'Follow status toggled' })
  @ApiResponse({ status: 400, description: 'Self-follow attempt or invalid target' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  async toggleFollow(
    @Param('id') targetId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const result = await this.profilesService.toggleFollow(user.id, targetId);
    return {
      success: true,
      data: result,
      message: result.isFollowing
        ? 'Now following scholar.'
        : 'Unfollowed scholar.',
    };
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Get paginated followers of a user' })
  async getFollowers(
    @Param('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    const result = await this.profilesService.getFollowers(userId, page, Math.min(limit, 50));
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Get paginated users followed by a user' })
  async getFollowing(
    @Param('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    const result = await this.profilesService.getFollowing(userId, page, Math.min(limit, 50));
    return {
      success: true,
      ...result,
    };
  }
}
