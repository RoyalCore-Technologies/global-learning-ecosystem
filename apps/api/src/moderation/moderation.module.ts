import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';
import { AdminGuard } from './guards/admin.guard.js';

@Module({
  controllers: [ModerationController],
  providers: [ModerationService, AdminGuard],
  exports: [ModerationService],
})
export class ModerationModule {}
