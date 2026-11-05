import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AcademicAiProvider } from './providers/academic-ai.provider.js';
import type {
  AiQueryRequestDto,
  AiQueryResponseDto,
  AssessmentCheckRequestDto,
  AssessmentCheckResponseDto,
  SubmitAssessmentRequestDto,
  SubmitAssessmentResultDto,
} from '@platform/types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiProvider: AcademicAiProvider
  ) {}

  /**
   * Generates a context-aware educational response, records the user session and message in the database,
   * and enforces learner privacy.
   */
  async processQuery(
    userId: string,
    dto: AiQueryRequestDto,
    sessionId?: string
  ): Promise<{ response: AiQueryResponseDto; session_id: string }> {
    const client = this.databaseService.getClient();
    let currentSessionId = sessionId;

    // 1. Fetch or create AI learning session
    if (currentSessionId) {
      const { data: session, error } = await client
        .from('ai_learning_sessions')
        .select('*')
        .eq('id', currentSessionId)
        .maybeSingle();

      if (error || !session) {
        throw new NotFoundException(`Learning session '${currentSessionId}' not found.`);
      }
      if (session.user_id !== userId) {
        throw new BadRequestException('Unauthorized access to learning session.');
      }
    } else {
      const { data: newSession, error: createErr } = await client
        .from('ai_learning_sessions')
        .insert({
          user_id: userId,
          course_id: dto.context?.course_id || null,
          lesson_id: dto.context?.lesson_id || null,
          mode: dto.mode || 'EXPLANATION',
          learner_level: dto.context?.learner_level || 'BEGINNER',
          title: dto.query.substring(0, 60),
        })
        .select('id')
        .single();

      if (createErr || !newSession) {
        this.logger.error(`Failed to create AI learning session: ${createErr?.message}`);
        throw new InternalServerErrorException('Failed to initialize AI learning session.');
      }
      currentSessionId = newSession.id;
    }

    // 2. Record User Query Message
    await client.from('ai_learning_messages').insert({
      session_id: currentSessionId,
      sender: 'user',
      content: dto.query.trim(),
    });

    // 3. Generate AI Explanation
    const learnerLevel = dto.context?.learner_level || 'BEGINNER';
    const aiResponse = await this.aiProvider.generateExplanation(dto, learnerLevel);

    // 4. Record AI Explanation Message
    await client.from('ai_learning_messages').insert({
      session_id: currentSessionId,
      sender: 'ai',
      content: aiResponse.text,
      code_snippet: aiResponse.codeSnippet || null,
      citations: aiResponse.citations,
      follow_up_questions: aiResponse.follow_up_questions,
      provider: aiResponse.provider,
      model: aiResponse.model,
    });

    // 5. Update session updated_at
    await client
      .from('ai_learning_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSessionId);

    return {
      response: aiResponse,
      session_id: currentSessionId!,
    };
  }

  /**
   * Generates a topic/lesson knowledge check assessment.
   */
  async generateAssessment(
    userId: string,
    dto: AssessmentCheckRequestDto
  ): Promise<AssessmentCheckResponseDto> {
    const client = this.databaseService.getClient();

    const assessment = await this.aiProvider.generateAssessment(dto);

    // Save assessment questions in database
    const { error } = await client.from('ai_assessments').insert({
      id: assessment.assessment_id.startsWith('assess-')
        ? undefined
        : assessment.assessment_id,
      user_id: userId,
      course_id: dto.context?.course_id || null,
      lesson_id: dto.context?.lesson_id || null,
      topic: dto.topic.trim(),
      level: dto.level || 'BEGINNER',
      questions: assessment.questions,
      total_questions: assessment.questions.length,
    });

    if (error) {
      this.logger.warn(`Could not persist assessment: ${error.message}`);
    }

    return assessment;
  }

  /**
   * Evaluates student submitted answers and computes mastery results.
   */
  async submitAssessment(
    userId: string,
    submission: SubmitAssessmentRequestDto,
    cachedAssessment?: AssessmentCheckResponseDto
  ): Promise<SubmitAssessmentResultDto> {
    const client = this.databaseService.getClient();

    let assessment = cachedAssessment;

    if (!assessment) {
      const { data: record, error } = await client
        .from('ai_assessments')
        .select('*')
        .eq('id', submission.assessment_id)
        .maybeSingle();

      if (error || !record) {
        throw new NotFoundException(`Assessment '${submission.assessment_id}' not found.`);
      }
      if (record.user_id !== userId) {
        throw new BadRequestException('Unauthorized access to assessment record.');
      }

      assessment = {
        assessment_id: record.id,
        topic: record.topic,
        level: record.level,
        questions: record.questions,
        created_at: record.created_at,
      };
    }

    const result = await this.aiProvider.gradeAssessment(submission, assessment);

    // Update database record with final grade
    await client
      .from('ai_assessments')
      .update({
        score: result.score,
        total_questions: result.total_questions,
        percentage: result.percentage,
        passed: result.passed,
        detailed_feedback: result.detailed_feedback,
        completed_at: new Date().toISOString(),
      })
      .eq('id', submission.assessment_id);

    return result;
  }
}
