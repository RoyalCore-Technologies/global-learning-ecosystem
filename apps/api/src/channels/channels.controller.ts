import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelsService } from './channels.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { UpdateChannelDto } from './dto/update-channel.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Creator Channels')
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @ApiOperation({ summary: 'Discover creator channels' })
  @ApiResponse({ status: 200, description: 'Channels list retrieved successfully' })
  async getChannels(
    @Query('search') search?: string,
    @Query('owner_id') ownerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const result = await this.channelsService.getChannels(search, page, limit, ownerId);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':slugOrId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get creator channel profile by unique slug or UUID' })
  @ApiResponse({ status: 200, description: 'Channel retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async getChannelBySlugOrId(
    @Param('slugOrId') slugOrId: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const data = await this.channelsService.getChannelBySlugOrId(slugOrId, user?.id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Establish a new creator channel (CREATOR, EDUCATOR, RESEARCHER, or ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Channel created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires creator or educator credentials' })
  async createChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChannelDto
  ) {
    const channel = await this.channelsService.createChannel(
      user.id,
      user.role as UserRole,
      dto
    );
    return {
      success: true,
      data: channel,
      message: 'Creator channel established successfully.',
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update creator channel profile (Owner or Platform Admin only)' })
  @ApiResponse({ status: 200, description: 'Channel updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: ownership required' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async updateChannel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateChannelDto
  ) {
    const updated = await this.channelsService.updateChannel(
      id,
      user.id,
      user.role as UserRole,
      dto
    );
    return {
      success: true,
      data: updated,
      message: 'Channel profile updated successfully.',
    };
  }

  @Post(':id/subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Subscribe to a creator channel (idempotent)' })
  @ApiResponse({ status: 200, description: 'Subscribed successfully' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async subscribeChannel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const subscriber = await this.channelsService.subscribeChannel(id, user.id);
    return {
      success: true,
      data: subscriber,
      message: 'Subscribed to creator channel.',
    };
  }

  @Post(':id/unsubscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unsubscribe from a creator channel (idempotent)' })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async unsubscribeChannel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.channelsService.unsubscribeChannel(id, user.id);
    return {
      success: true,
      message: 'Unsubscribed from creator channel.',
    };
  }

  @Get(':id/subscribers')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List channel subscribers' })
  @ApiResponse({ status: 200, description: 'Subscribers retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async getSubscribers(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const subscribers = await this.channelsService.getSubscribers(
      id,
      user?.id,
      user?.role as UserRole
    );
    return {
      success: true,
      data: subscribers,
    };
  }
}
