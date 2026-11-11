import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AcademicAiProvider } from './providers/academic-ai.provider.js';
import { AiSafetyService } from './safety/ai-safety.service.js';

@Module({
  controllers: [AiController],
  providers: [AiService, AcademicAiProvider, AiSafetyService],
  exports: [AiService, AcademicAiProvider, AiSafetyService],
})
export class AiModule {}
