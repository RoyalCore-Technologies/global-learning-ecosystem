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
import { PostsService } from './posts.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { FeedQueryDto } from './dto/feed-query.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Knowledge Posts & Discovery')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new educational knowledge post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto
  ) {
    const post = await this.postsService.createPost(user.id, dto);
    return {
      success: true,
      data: post,
      message: 'Knowledge post published successfully.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Discover knowledge posts by recent, accuracy-endorsed, or following feed' })
  @ApiResponse({ status: 200, description: 'Feed retrieved successfully' })
  async getFeed(
    @Query() query: FeedQueryDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const result = await this.postsService.getFeed(query, user?.id);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get full knowledge post details by unique slug' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getPostBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const post = await this.postsService.getPostBySlug(slug, user?.id);
    return {
      success: true,
      data: post,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an existing post (author or platform admin only)' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async updatePost(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePostDto
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const updated = await this.postsService.updatePost(postId, user.id, isAdmin, dto);
    return {
      success: true,
      data: updated,
      message: 'Post updated successfully.',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete an existing post (author or platform admin only)' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async deletePost(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    await this.postsService.deletePost(postId, user.id, isAdmin);
    return {
      success: true,
      message: 'Post deleted successfully.',
    };
  }
}
