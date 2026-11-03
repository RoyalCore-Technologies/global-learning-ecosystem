import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('Curriculum Lessons & Progress')
@Controller('lessons')
export class LessonProgressController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post(':id/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark lesson as complete or incomplete for authenticated enrolled student' })
  @ApiResponse({ status: 200, description: 'Lesson progress recorded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: not enrolled in parent course' })
  @ApiResponse({ status: 404, description: 'Lesson or parent course module not found' })
  async updateProgress(
    @Param('id') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProgressDto
  ) {
    const isCompleted = dto.is_completed !== undefined ? dto.is_completed : true;
    const result = await this.enrollmentsService.updateLessonProgress(
      user.id,
      lessonId,
      isCompleted
    );

    return {
      success: true,
      data: result.progress,
      enrollment: result.enrollment,
      message: isCompleted
        ? 'Lesson marked as completed.'
        : 'Lesson marked as incomplete.',
    };
  }
}
