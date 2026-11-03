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
import { CoursesService } from './courses.service.js';
import { CourseQueryDto } from './dto/course-query.dto.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { InstructorGuard } from './guards/instructor.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UserRole } from '@platform/types';

@ApiTags('Courses & Learning Syllabi')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Public course catalog with pagination, filters, and search' })
  @ApiResponse({ status: 200, description: 'Courses retrieved successfully' })
  async getCourses(
    @Query() query: CourseQueryDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const result = await this.coursesService.getCourses(
      query,
      user?.id,
      user?.role as UserRole
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get(':slugOrId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get course details with ordered syllabus and privacy redactions' })
  @ApiResponse({ status: 200, description: 'Course syllabus retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Course not found or unauthorized draft' })
  async getCourseBySlugOrId(
    @Param('slugOrId') slugOrId: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const course = await this.coursesService.getCourseBySlugOrId(
      slugOrId,
      user?.id,
      user?.role as UserRole
    );
    return {
      success: true,
      data: course,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, InstructorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new course (EDUCATOR, CREATOR, RESEARCHER, or ADMIN)' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires verified creator credentials' })
  async createCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto
  ) {
    const course = await this.coursesService.createCourse(user.id, dto);
    return {
      success: true,
      data: course,
      message: 'Course created successfully.',
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an existing course (instructor owner or platform admin only)' })
  @ApiResponse({ status: 200, description: 'Course updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async updateCourse(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourseDto
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const updated = await this.coursesService.updateCourse(courseId, user.id, isAdmin, dto);
    return {
      success: true,
      data: updated,
      message: 'Course updated successfully.',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a course (instructor owner or platform admin only)' })
  @ApiResponse({ status: 200, description: 'Course deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async deleteCourse(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    await this.coursesService.deleteCourse(courseId, user.id, isAdmin);
    return {
      success: true,
      message: 'Course deleted successfully.',
    };
  }

  @Post(':id/modules')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a new module to a course syllabus' })
  @ApiResponse({ status: 201, description: 'Module created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async createModule(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateModuleDto
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const moduleRecord = await this.coursesService.createModule(courseId, user.id, isAdmin, dto);
    return {
      success: true,
      data: moduleRecord,
      message: 'Module created successfully.',
    };
  }

  @Post('modules/:id/lessons')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a lesson to a module (alias under /courses)' })
  @ApiResponse({ status: 201, description: 'Lesson created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: not course instructor' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  async createLessonAlias(
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
}
