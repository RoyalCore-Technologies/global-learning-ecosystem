import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Threaded Comments & Discourse')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'Get all discussion comments for a post in hierarchical tree order' })
  @ApiResponse({ status: 200, description: 'Comments tree retrieved successfully' })
  async getPostComments(@Param('postId') postId: string) {
    const comments = await this.commentsService.getPostComments(postId);
    return {
      success: true,
      data: comments,
    };
  }

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a new comment or reply to a knowledge post' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createComment(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto
  ) {
    const comment = await this.commentsService.createComment(postId, user.id, dto);
    return {
      success: true,
      data: comment,
      message: dto.parent_comment_id
        ? 'Reply submitted successfully.'
        : 'Discussion comment submitted.',
    };
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Edit an existing comment (comment author only)' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not comment author' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async updateComment(
    @Param('id') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto
  ) {
    const updated = await this.commentsService.updateComment(commentId, user.id, dto);
    return {
      success: true,
      data: updated,
      message: 'Comment updated successfully.',
    };
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a comment (comment author, post author, or admin)' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteComment(
    @Param('id') commentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    await this.commentsService.deleteComment(commentId, user.id, isAdmin);
    return {
      success: true,
      message: 'Comment deleted successfully.',
    };
  }

  @Post('comments/:id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Pin or unpin a comment (post author or admin only)' })
  @ApiResponse({ status: 200, description: 'Comment pin status toggled' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async togglePin(
    @Param('id') commentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const result = await this.commentsService.togglePin(commentId, user.id, isAdmin);
    return {
      success: true,
      data: result,
      message: result.isPinned ? 'Comment pinned to top.' : 'Comment unpinned.',
    };
  }

  @Post('comments/:id/solution')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark or unmark a comment as the accepted solution (post author or admin only)' })
  @ApiResponse({ status: 200, description: 'Accepted solution toggled' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async toggleSolution(
    @Param('id') commentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const result = await this.commentsService.toggleSolution(commentId, user.id, isAdmin);
    return {
      success: true,
      data: result,
      message: result.isSolution ? 'Marked as accepted solution.' : 'Removed accepted solution.',
    };
  }
}
