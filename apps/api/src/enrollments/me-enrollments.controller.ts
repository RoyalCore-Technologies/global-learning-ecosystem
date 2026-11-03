import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentQueryDto } from './dto/enrollment-query.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('My Learning Dashboard')
@Controller('me')
export class MeEnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('enrollments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user course enrollments and progress' })
  @ApiResponse({ status: 200, description: 'User enrollments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyEnrollments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EnrollmentQueryDto
  ) {
    const result = await this.enrollmentsService.getMyEnrollments(user.id, query);
    return {
      success: true,
      ...result,
    };
  }
}
