import {
  Controller,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CoursesService } from './courses.service.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Curriculum Lessons')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly coursesService: CoursesService) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an existing lesson (instructor owner or platform admin only)' })
  @ApiResponse({ status: 200, description: 'Lesson updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  async updateLesson(
    @Param('id') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLessonDto
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const updated = await this.coursesService.updateLesson(lessonId, user.id, isAdmin, dto);
    return {
      success: true,
      data: updated,
      message: 'Lesson updated successfully.',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a lesson (instructor owner or platform admin only)' })
  @ApiResponse({ status: 200, description: 'Lesson deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  async deleteLesson(
    @Param('id') lessonId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    await this.coursesService.deleteLesson(lessonId, user.id, isAdmin);
    return {
      success: true,
      message: 'Lesson deleted successfully.',
    };
  }
}
