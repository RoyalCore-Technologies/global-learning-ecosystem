import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CoursesController } from './courses.controller.js';
import { ModulesController } from './modules.controller.js';
import { LessonsController } from './lessons.controller.js';
import { CoursesService } from './courses.service.js';
import { InstructorGuard } from './guards/instructor.guard.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CoursesController, ModulesController, LessonsController],
  providers: [CoursesService, InstructorGuard],
  exports: [CoursesService],
})
export class CoursesModule {}
