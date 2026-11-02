import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InteractionsService } from './interactions.service.js';
import { ToggleInteractionDto } from './dto/toggle-interaction.dto.js';
import { ToggleBookmarkDto } from './dto/toggle-bookmark.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('Interactions & Academic Endorsements')
@Controller('posts/:id')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post('interactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Toggle insightful upvote or academic accuracy endorsement',
    description:
      'Any user may upvote a post as insightful. Academic accuracy endorsements are strictly restricted to verified EDUCATOR and RESEARCHER credentials.',
  })
  @ApiResponse({ status: 200, description: 'Interaction toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: accuracy endorsement requires educator/researcher role' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async toggleInteraction(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ToggleInteractionDto
  ) {
    const result = await this.interactionsService.toggleInteraction(
      user.id,
      user.role,
      postId,
      dto.type
    );
    return {
      success: true,
      data: result,
      message: result.isInteracted
        ? `Marked post as ${dto.type.toLowerCase().replace('_', ' ')}.`
        : `Removed ${dto.type.toLowerCase().replace('_', ' ')}.`,
    };
  }

  @Post('bookmarks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Save or unsave post to personal reading list' })
  @ApiResponse({ status: 200, description: 'Bookmark toggled successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async toggleBookmark(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ToggleBookmarkDto
  ) {
    const result = await this.interactionsService.toggleBookmark(user.id, postId, dto);
    return {
      success: true,
      data: result,
      message: result.isBookmarked
        ? 'Post saved to reading list.'
        : 'Post removed from reading list.',
    };
  }
}
