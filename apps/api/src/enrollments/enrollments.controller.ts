import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('Course Enrollments & Progress')
@Controller('courses')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Enroll authenticated student in a published free course (idempotent)' })
  @ApiResponse({ status: 200, description: 'Enrolled successfully or already enrolled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 402, description: 'Payment required for premium course' })
  @ApiResponse({ status: 404, description: 'Course not found or unpublished' })
  async enroll(
    @Param('id') courseIdOrSlug: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const { enrollment, isExisting } = await this.enrollmentsService.enrollInCourse(
      user.id,
      courseIdOrSlug
    );

    return {
      success: true,
      data: enrollment,
      message: isExisting
        ? 'Already enrolled in this course.'
        : 'Successfully enrolled in course.',
    };
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get course progress summary for authenticated enrolled student' })
  @ApiResponse({ status: 200, description: 'Course progress retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Course or enrollment not found' })
  async getCourseProgress(
    @Param('id') courseIdOrSlug: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const progressSummary = await this.enrollmentsService.getCourseProgress(
      user.id,
      courseIdOrSlug
    );

    return {
      success: true,
      data: progressSummary,
    };
  }
}
