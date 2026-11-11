import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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

  private extractToken(req?: Request): string | undefined {
    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return undefined;
  }

  @Post('query')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit query to AI cognitive companion with educational scaffolding' })
  @ApiResponse({ status: 200, description: 'Cognitive explanation generated' })
  async queryAi(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueryAiDto,
    @Req() req: Request
  ) {
    const result = await this.aiService.processQuery(
      user.id,
      dto,
      undefined,
      this.extractToken(req)
    );
    return {
      success: true,
      ...result,
    };
  }

  @Post('query/stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream contextual AI educational response over Server-Sent Events (SSE)' })
  async streamQueryAi(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueryAiDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    return this.handleSseStream(user.id, dto, undefined, req, res);
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
    @Body() dto: QueryAiDto,
    @Req() req: Request
  ) {
    const result = await this.aiService.processQuery(
      user.id,
      dto,
      sessionId,
      this.extractToken(req)
    );
    return {
      success: true,
      ...result,
    };
  }

  @Post('sessions/:sessionId/stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream follow-up response within an existing AI session over SSE' })
  async streamContinueSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: QueryAiDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    return this.handleSseStream(user.id, dto, sessionId, req, res);
  }

  private async handleSseStream(
    userId: string,
    dto: QueryAiDto,
    sessionId: string | undefined,
    req: Request,
    res: Response
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      await this.aiService.processQueryStream(
        userId,
        dto,
        (chunk) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        },
        sessionId,
        this.extractToken(req)
      );
    } catch (err: any) {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            event: 'error',
            error: err?.message || 'AI companion streaming failed.',
          })}\n\n`
        );
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List persisted AI learning sessions for current learner' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('lessonId') lessonId?: string,
    @Req() req?: Request
  ) {
    const sessions = await this.aiService.getSessions(
      user.id,
      courseId,
      lessonId,
      this.extractToken(req)
    );
    return {
      success: true,
      data: sessions,
    };
  }

  @Get('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve a specific AI learning session with full message history' })
  async getSessionDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const session = await this.aiService.getSessionDetail(
      user.id,
      sessionId,
      this.extractToken(req)
    );
    return {
      success: true,
      data: session,
    };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific AI learning session' })
  async deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    await this.aiService.deleteSession(user.id, sessionId, this.extractToken(req));
    return {
      success: true,
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
    @Body() dto: GenerateAssessmentDto,
    @Req() req: Request
  ) {
    const assessment = await this.aiService.generateAssessment(
      user.id,
      dto,
      this.extractToken(req)
    );
    return {
      success: true,
      data: assessment,
    };
  }

  @Get('assessments/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List past AI knowledge-check assessments for current learner' })
  async getAssessmentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Req() req?: Request
  ) {
    const history = await this.aiService.getAssessmentHistory(
      user.id,
      courseId,
      this.extractToken(req)
    );
    return {
      success: true,
      data: history,
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
    @Body() dto: SubmitAssessmentDto,
    @Req() req: Request
  ) {
    const result = await this.aiService.submitAssessment(
      user.id,
      dto,
      undefined,
      this.extractToken(req)
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get('adaptive/recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve adaptive learning recommendations and concept mastery records' })
  @ApiResponse({ status: 200, description: 'Adaptive recommendations returned' })
  async getAdaptiveRecommendations(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const recommendations = await this.aiService.getAdaptiveRecommendations(
      user.id,
      this.extractToken(req)
    );
    return {
      success: true,
      data: recommendations,
    };
  }
}
