import {
  Controller,
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
import { CoursesService } from './courses.service.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Course Modules & Curriculum')
@Controller('modules')
export class ModulesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post(':id/lessons')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a new lesson to a syllabus module' })
  @ApiResponse({ status: 201, description: 'Lesson created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  async createLesson(
    @Param('id') moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDto
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const lesson = await this.coursesService.createLesson(moduleId, user.id, isAdmin, dto);
    return {
      success: true,
      data: lesson,
      message: 'Lesson created successfully.',
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an existing syllabus module' })
  @ApiResponse({ status: 200, description: 'Module updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  async updateModule(
    @Param('id') moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateModuleDto
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const updated = await this.coursesService.updateModule(moduleId, user.id, isAdmin, dto);
    return {
      success: true,
      data: updated,
      message: 'Module updated successfully.',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a syllabus module' })
  @ApiResponse({ status: 200, description: 'Module deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  async deleteModule(
    @Param('id') moduleId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    await this.coursesService.deleteModule(moduleId, user.id, isAdmin);
    return {
      success: true,
      message: 'Module deleted successfully.',
    };
  }
}
