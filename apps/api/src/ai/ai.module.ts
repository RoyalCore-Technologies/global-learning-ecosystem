import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AcademicAiProvider } from './providers/academic-ai.provider.js';

@Module({
  controllers: [AiController],
  providers: [AiService, AcademicAiProvider],
  exports: [AiService, AcademicAiProvider],
})
export class AiModule {}
