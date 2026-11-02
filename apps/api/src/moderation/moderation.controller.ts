import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ModerationService } from './moderation.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ResolveReportDto } from './dto/resolve-report.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import type { ReportStatus } from '@platform/types';

@ApiTags('Trust, Safety & Moderation')
@Controller('reports')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit an abuse, harassment, or academic misconduct report' })
  @ApiResponse({ status: 201, description: 'Report filed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate report' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto
  ) {
    const report = await this.moderationService.createReport(user.id, dto);
    return {
      success: true,
      data: report,
      message: 'Thank you for helping keep the Learnova ecosystem safe and academically rigorous.',
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get active moderation report queue (administrator only)' })
  @ApiResponse({ status: 200, description: 'Reports queue retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: admin only' })
  async getReportsQueue(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: ReportStatus
  ) {
    const result = await this.moderationService.getReportsQueue(
      page,
      Math.min(limit, 50),
      status
    );
    return {
      success: true,
      ...result,
    };
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Resolve a moderation report with auditable action (administrator only)' })
  @ApiResponse({ status: 200, description: 'Report resolved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: admin only' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async resolveReport(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveReportDto
  ) {
    const resolved = await this.moderationService.resolveReport(reportId, user.id, dto);
    return {
      success: true,
      data: resolved,
      message: `Report resolved as ${dto.status}.`,
    };
  }
}
