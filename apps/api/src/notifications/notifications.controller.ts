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
import { NotificationsService } from './notifications.service.js';
import { NotificationPreferencesDto } from '../profiles/dto/update-profile.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('In-App Notifications & Alert Preferences')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated in-app notifications with unread count' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    const result = await this.notificationsService.getUserNotifications(
      user.id,
      page,
      Math.min(limit, 50)
    );
    return {
      success: true,
      ...result,
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an individual notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Param('id') notificationId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.notificationsService.markAsRead(notificationId, user.id);
    return {
      success: true,
      message: 'Notification marked as read.',
    };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.notificationsService.markAllAsRead(user.id);
    return {
      success: true,
      data: result,
      message: 'All notifications marked as read.',
    };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification delivery preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    const preferences = await this.notificationsService.getPreferences(user.id);
    return {
      success: true,
      data: preferences,
    };
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification delivery preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NotificationPreferencesDto
  ) {
    const updated = await this.notificationsService.updatePreferences(user.id, dto);
    return {
      success: true,
      data: updated,
      message: 'Notification preferences updated.',
    };
  }
}
