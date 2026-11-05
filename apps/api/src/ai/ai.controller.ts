import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { QueryAiDto, GenerateAssessmentDto, SubmitAssessmentDto } from './dto/ai-query.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';

@ApiTags('AI Learning Companion & Assessments')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit query to AI cognitive companion with educational scaffolding' })
  @ApiResponse({ status: 200, description: 'Cognitive explanation generated' })
  async queryAi(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueryAiDto
  ) {
    const result = await this.aiService.processQuery(user.id, dto);
    return {
      success: true,
      ...result,
    };
  }

  @Post('sessions/:sessionId/query')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Continue multi-turn conversation within an existing AI session' })
  @ApiResponse({ status: 200, description: 'Follow-up explanation generated' })
  async continueSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: QueryAiDto
  ) {
    const result = await this.aiService.processQuery(user.id, dto, sessionId);
    return {
      success: true,
      ...result,
    };
  }

  @Post('assessments/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate knowledge-check assessment on a topic or lesson' })
  @ApiResponse({ status: 200, description: 'Assessment questions generated' })
  async generateAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateAssessmentDto
  ) {
    const assessment = await this.aiService.generateAssessment(user.id, dto);
    return {
      success: true,
      data: assessment,
    };
  }

  @Post('assessments/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit answers for evaluation and mastery feedback' })
  @ApiResponse({ status: 200, description: 'Assessment graded and feedback returned' })
  async submitAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitAssessmentDto
  ) {
    const result = await this.aiService.submitAssessment(user.id, dto);
    return {
      success: true,
      data: result,
    };
  }
}
