import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { MeEnrollmentsController } from './me-enrollments.controller.js';
import { LessonProgressController } from './lesson-progress.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    EnrollmentsController,
    MeEnrollmentsController,
    LessonProgressController,
  ],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
