import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AcademicAiProvider } from './providers/academic-ai.provider.js';
import { AiSafetyService } from './safety/ai-safety.service.js';
import type {
  AiQueryRequestDto,
  AiQueryResponseDto,
  AiInteractionContext,
  AssessmentCheckRequestDto,
  AssessmentCheckResponseDto,
  SubmitAssessmentRequestDto,
  SubmitAssessmentResultDto,
  AdaptiveRecommendationsDto,
  ConceptMasteryRecord,
  AiStreamChunk,
  AiLearningSessionSummary,
  AiLearningSessionDetail,
  AiAssessmentSummary,
  AiChatMessage,
} from '@platform/types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly safetyService: AiSafetyService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiProvider: AcademicAiProvider,
    aiSafetyService?: AiSafetyService
  ) {
    this.safetyService = aiSafetyService || new AiSafetyService();
  }

  /**
   * Authorizes and enriches course/lesson context via backend database lookups.
   * Ensures learners can only access lesson content if enrolled, viewing a preview lesson,
   * or acting as the course instructor.
   */
  private async resolveAuthorizedContext(
    client: ReturnType<DatabaseService['getClient']>,
    userId: string,
    context?: AiInteractionContext
  ): Promise<AiInteractionContext | undefined> {
    if (!context) return undefined;
    if (!context.course_id && !context.lesson_id) {
      return context;
    }

    const enriched: AiInteractionContext = { ...context };
    let courseInstructorId: string | null = null;

    if (context.course_id) {
      const { data: course, error: courseErr } = await client
        .from('courses')
        .select('id, title, instructor_id, is_published')
        .eq('id', context.course_id)
        .maybeSingle();

      if (courseErr || !course) {
        throw new NotFoundException(`Course '${context.course_id}' not found.`);
      }

      if (!course.is_published && course.instructor_id !== userId) {
        throw new ForbiddenException('Unauthorized access to unpublished course context.');
      }

      courseInstructorId = course.instructor_id;
      enriched.course_title = course.title;
    }

    if (context.lesson_id) {
      const { data: lesson, error: lessonErr } = await client
        .from('lessons')
        .select('id, title, content, is_preview, module_id')
        .eq('id', context.lesson_id)
        .maybeSingle();

      if (lessonErr || !lesson) {
        throw new NotFoundException(`Lesson '${context.lesson_id}' not found.`);
      }

      const isInstructor = courseInstructorId !== null && courseInstructorId === userId;
      let isEnrolled = false;

      if (!lesson.is_preview && !isInstructor) {
        if (context.course_id) {
          const { data: enrollment } = await client
            .from('course_enrollments')
            .select('id')
            .eq('course_id', context.course_id)
            .eq('user_id', userId)
            .maybeSingle();
          isEnrolled = !!enrollment;
        }

        if (!isEnrolled) {
          throw new ForbiddenException(
            'Enroll in this course to access lesson-specific AI tutoring.'
          );
        }
      }

      enriched.lesson_title = lesson.title;
      if (lesson.content && !enriched.lesson_content) {
        enriched.lesson_content = lesson.content;
      }
    }

    return enriched;
  }

  private async logSafetyEvent(
    client: ReturnType<DatabaseService['getClient']>,
    params: {
      userId: string;
      sessionId?: string | null;
      courseId?: string | null;
      category: 'PROMPT_INJECTION' | 'UNSAFE_CONTENT' | 'PII_REDACTED' | 'ACADEMIC_DISHONESTY' | 'AGE_RESTRICTED';
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      actionTaken: 'BLOCKED' | 'REDACTED' | 'GUIDED_REDIRECT';
    }
  ): Promise<void> {
    try {
      const table = client.from('ai_safety_events');
      if (table && typeof table.insert === 'function') {
        await table.insert({
          user_id: params.userId,
          session_id: params.sessionId || null,
          course_id: params.courseId || null,
          category: params.category,
          severity: params.severity,
          action_taken: params.actionTaken,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to log AI safety event: ${err?.message}`);
    }
  }

  /**
   * Prepares session ownership, fetches persistent conversation history,
   * enforces course/lesson context authorization, and evaluates safety guardrails.
   */
  private async prepareQueryExecution(
    client: ReturnType<DatabaseService['getClient']>,
    userId: string,
    dto: AiQueryRequestDto,
    sessionId?: string
  ): Promise<{
    currentSessionId: string;
    safeDto: AiQueryRequestDto;
    learnerLevel: string;
    blockedResponse: AiQueryResponseDto | null;
    language: string;
    safetyStatus: 'SAFE' | 'PROMPT_INJECTION' | 'UNSAFE_CONTENT' | 'PII_REDACTED' | 'ACADEMIC_DISHONESTY' | 'AGE_RESTRICTED';
  }> {
    let currentSessionId = sessionId;
    let persistedHistory: Array<{ sender: 'user' | 'ai'; text: string }> =
      dto.conversation_history || [];

    // 1. Authorize course & lesson context if provided
    const authorizedContext = await this.resolveAuthorizedContext(
      client,
      userId,
      dto.context
    );

    // 2. Evaluate prompt-injection, safety, age calibration & PII redaction
    const safetyEval = this.safetyService.evaluateAndSanitizeInput(
      dto.query,
      authorizedContext
    );

    const language = safetyEval.sanitizedContext?.preferred_language ||
      this.safetyService.normalizeLanguage(dto.context?.preferred_language);
    const ageGroup = safetyEval.sanitizedContext?.age_group ||
      this.safetyService.normalizeAgeGroup(dto.context?.age_group);

    // 3. Fetch or create AI learning session (always enforced by user_id)
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

      // Load persisted conversation turns if caller didn't pass history
      if (persistedHistory.length === 0) {
        const msgTable = client.from('ai_learning_messages');
        if (msgTable && typeof msgTable.select === 'function') {
          const selectRes: any = msgTable
            .select('sender, content')
            .eq('session_id', currentSessionId);
          if (selectRes && typeof selectRes.order === 'function') {
            const { data: prevMsgs } = await selectRes.order('created_at', { ascending: true });
            if (Array.isArray(prevMsgs)) {
              persistedHistory = prevMsgs
                .filter((m: any) => m.sender === 'user' || m.sender === 'ai')
                .slice(-8)
                .map((m: any) => ({ sender: m.sender, text: m.content }));
            }
          }
        }
      }
    } else {
      const { data: newSession, error: createErr } = await client
        .from('ai_learning_sessions')
        .insert({
          user_id: userId,
          course_id: authorizedContext?.course_id || null,
          lesson_id: authorizedContext?.lesson_id || null,
          mode: safetyEval.forceSocratic ? 'SOCRATIC' : dto.mode || 'EXPLANATION',
          learner_level: dto.context?.learner_level || 'BEGINNER',
          language,
          age_group: ageGroup,
          title: (safetyEval.allowed ? safetyEval.sanitizedQuery : 'Safety Guardrail Notice').substring(0, 60),
        })
        .select('id')
        .single();

      if (createErr || !newSession) {
        this.logger.error(`Failed to create AI learning session: ${createErr?.message}`);
        throw new InternalServerErrorException('Failed to initialize AI learning session.');
      }
      currentSessionId = newSession.id;
    }

    // 4. Handle blocked unsafe/injection requests without calling external LLM
    if (!safetyEval.allowed) {
      await this.logSafetyEvent(client, {
        userId,
        sessionId: currentSessionId,
        courseId: authorizedContext?.course_id || null,
        category: safetyEval.category as any,
        severity: safetyEval.severity,
        actionTaken: 'BLOCKED',
      });

      const refusal: AiQueryResponseDto = {
        message_id: `safety-${Date.now()}`,
        text: safetyEval.userMessage || 'Request blocked by educational safety guardrails.',
        mode: dto.mode || 'EXPLANATION',
        codeSnippet: null,
        citations: ['Learnova Global Trust, Safety & Privacy Policy'],
        follow_up_questions: ['Can I help explain a concept from your active lesson instead?'],
        educational_assessment: null,
        provider: 'learnova-safety-guardrail',
        model: 'policy-enforcement',
        is_fallback: false,
        language,
        safety_status: safetyEval.category,
        created_at: new Date().toISOString(),
      };

      return {
        currentSessionId: currentSessionId!,
        safeDto: dto,
        learnerLevel: dto.context?.learner_level || 'BEGINNER',
        blockedResponse: refusal,
        language,
        safetyStatus: safetyEval.category,
      };
    }

    if (safetyEval.action === 'REDACTED' || safetyEval.action === 'GUIDED_REDIRECT') {
      await this.logSafetyEvent(client, {
        userId,
        sessionId: currentSessionId,
        courseId: authorizedContext?.course_id || null,
        category: safetyEval.category as any,
        severity: safetyEval.severity,
        actionTaken: safetyEval.action,
      });
    }

    const effectiveMode = safetyEval.forceSocratic ? 'SOCRATIC' : dto.mode || 'EXPLANATION';
    const effectiveLevel = dto.context?.learner_level || 'BEGINNER';

    const safeDto: AiQueryRequestDto = {
      query: safetyEval.sanitizedQuery,
      mode: effectiveMode,
      context: safetyEval.sanitizedContext,
      conversation_history: persistedHistory,
    };

    return {
      currentSessionId: currentSessionId!,
      safeDto,
      learnerLevel: effectiveLevel,
      blockedResponse: null,
      language,
      safetyStatus: safetyEval.category,
    };
  }

  /**
   * Generates a context-aware educational response, records the user session and message in the database,
   * and enforces learner privacy and safety guardrails.
   */
  async processQuery(
    userId: string,
    dto: AiQueryRequestDto,
    sessionId?: string,
    accessToken?: string
  ): Promise<{ response: AiQueryResponseDto; session_id: string }> {
    const client = this.databaseService.getClient(accessToken);

    const prep = await this.prepareQueryExecution(client, userId, dto, sessionId);
    if (prep.blockedResponse) {
      return {
        response: prep.blockedResponse,
        session_id: prep.currentSessionId,
      };
    }

    // Record sanitized user query message
    await client.from('ai_learning_messages').insert({
      session_id: prep.currentSessionId,
      sender: 'user',
      content: prep.safeDto.query,
      language: prep.language,
      safety_status: prep.safetyStatus,
    });

    // Generate AI explanation (live or honest fallback)
    const aiResponse = await this.aiProvider.generateExplanation(
      prep.safeDto,
      prep.learnerLevel
    );
    aiResponse.safety_status = prep.safetyStatus;
    aiResponse.language = prep.language;

    // Record AI message
    await client.from('ai_learning_messages').insert({
      session_id: prep.currentSessionId,
      sender: 'ai',
      content: aiResponse.text,
      code_snippet: aiResponse.codeSnippet || null,
      citations: aiResponse.citations,
      follow_up_questions: aiResponse.follow_up_questions,
      provider: aiResponse.provider,
      model: aiResponse.model,
      is_fallback: !!aiResponse.is_fallback,
      safety_status: prep.safetyStatus,
      language: prep.language,
    });

    // Update session updated_at
    await client
      .from('ai_learning_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', prep.currentSessionId);

    return {
      response: aiResponse,
      session_id: prep.currentSessionId,
    };
  }

  /**
   * Streams a context-aware educational response incrementally over SSE.
   */
  async processQueryStream(
    userId: string,
    dto: AiQueryRequestDto,
    onEvent: (chunk: AiStreamChunk) => void,
    sessionId?: string,
    accessToken?: string
  ): Promise<{ response: AiQueryResponseDto; session_id: string }> {
    const client = this.databaseService.getClient(accessToken);
    const prep = await this.prepareQueryExecution(client, userId, dto, sessionId);

    onEvent({ event: 'session', session_id: prep.currentSessionId });

    if (prep.blockedResponse) {
      onEvent({ event: 'delta', session_id: prep.currentSessionId, delta: prep.blockedResponse.text });
      onEvent({
        event: 'complete',
        session_id: prep.currentSessionId,
        response: prep.blockedResponse,
      });
      return {
        response: prep.blockedResponse,
        session_id: prep.currentSessionId,
      };
    }

    // Record sanitized user query
    await client.from('ai_learning_messages').insert({
      session_id: prep.currentSessionId,
      sender: 'user',
      content: prep.safeDto.query,
      language: prep.language,
      safety_status: prep.safetyStatus,
    });

    const aiResponse = this.aiProvider.generateExplanationStream
      ? await this.aiProvider.generateExplanationStream(
          prep.safeDto,
          prep.learnerLevel,
          (delta) => onEvent({ event: 'delta', session_id: prep.currentSessionId, delta })
        )
      : await this.aiProvider.generateExplanation(prep.safeDto, prep.learnerLevel);

    if (!this.aiProvider.generateExplanationStream) {
      onEvent({ event: 'delta', session_id: prep.currentSessionId, delta: aiResponse.text });
    }

    aiResponse.safety_status = prep.safetyStatus;
    aiResponse.language = prep.language;

    await client.from('ai_learning_messages').insert({
      session_id: prep.currentSessionId,
      sender: 'ai',
      content: aiResponse.text,
      code_snippet: aiResponse.codeSnippet || null,
      citations: aiResponse.citations,
      follow_up_questions: aiResponse.follow_up_questions,
      provider: aiResponse.provider,
      model: aiResponse.model,
      is_fallback: !!aiResponse.is_fallback,
      safety_status: prep.safetyStatus,
      language: prep.language,
    });

    await client
      .from('ai_learning_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', prep.currentSessionId);

    onEvent({
      event: 'complete',
      session_id: prep.currentSessionId,
      response: aiResponse,
    });

    return {
      response: aiResponse,
      session_id: prep.currentSessionId,
    };
  }

  /**
   * Lists persisted AI learning sessions belonging to the authenticated learner.
   */
  async getSessions(
    userId: string,
    courseId?: string,
    lessonId?: string,
    accessToken?: string
  ): Promise<AiLearningSessionSummary[]> {
    const client = this.databaseService.getClient(accessToken);

    let query: any = client
      .from('ai_learning_sessions')
      .select('*')
      .eq('user_id', userId);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(25);

    if (error) {
      this.logger.error(`Failed to list AI sessions: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve learning sessions.');
    }

    return (data || []) as AiLearningSessionSummary[];
  }

  /**
   * Retrieves a specific AI learning session and its ordered message history.
   */
  async getSessionDetail(
    userId: string,
    sessionId: string,
    accessToken?: string
  ): Promise<AiLearningSessionDetail> {
    const client = this.databaseService.getClient(accessToken);

    const { data: session, error } = await client
      .from('ai_learning_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      throw new NotFoundException(`Learning session '${sessionId}' not found.`);
    }
    if (session.user_id !== userId) {
      throw new ForbiddenException('Unauthorized access to learning session.');
    }

    const { data: msgRows, error: msgErr } = await client
      .from('ai_learning_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (msgErr) {
      this.logger.error(`Failed to load messages for session ${sessionId}: ${msgErr.message}`);
      throw new InternalServerErrorException('Failed to load session messages.');
    }

    const messages: AiChatMessage[] = (msgRows || []).map((m: any) => ({
      id: m.id,
      sender: m.sender,
      text: m.content,
      codeSnippet: m.code_snippet || undefined,
      citations: m.citations || [],
      follow_up_questions: m.follow_up_questions || [],
      provider: m.provider || undefined,
      model: m.model || undefined,
      is_fallback: !!m.is_fallback,
      language: m.language || 'en',
      safety_status: m.safety_status || 'SAFE',
      timestamp: m.created_at,
    }));

    return {
      ...(session as AiLearningSessionSummary),
      messages,
    };
  }

  /**
   * Deletes a learner's AI learning session cleanly.
   */
  async deleteSession(
    userId: string,
    sessionId: string,
    accessToken?: string
  ): Promise<void> {
    const client = this.databaseService.getClient(accessToken);

    const { data: session, error } = await client
      .from('ai_learning_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      throw new NotFoundException(`Learning session '${sessionId}' not found.`);
    }
    if (session.user_id !== userId) {
      throw new ForbiddenException('Unauthorized deletion of learning session.');
    }

    await client.from('ai_learning_sessions').delete().eq('id', sessionId);
  }

  /**
   * Generates a topic/lesson knowledge check assessment and persists it with its real DB UUID.
   */
  async generateAssessment(
    userId: string,
    dto: AssessmentCheckRequestDto,
    accessToken?: string
  ): Promise<AssessmentCheckResponseDto> {
    const client = this.databaseService.getClient(accessToken);
    const authorizedContext = await this.resolveAuthorizedContext(client, userId, dto.context);
    const safetyEval = this.safetyService.evaluateAndSanitizeInput(
      dto.topic,
      authorizedContext
    );

    if (!safetyEval.allowed) {
      throw new BadRequestException(
        safetyEval.userMessage || 'Assessment topic rejected by safety guardrails.'
      );
    }

    const language =
      safetyEval.sanitizedContext?.preferred_language ||
      this.safetyService.normalizeLanguage(dto.context?.preferred_language);

    const assessment = await this.aiProvider.generateAssessment({
      ...dto,
      topic: safetyEval.sanitizedQuery,
      context: safetyEval.sanitizedContext,
    });

    // Save assessment questions in database and return persisted UUID so submitAssessment matches!
    const insertBuilder: any = client.from('ai_assessments').insert({
      id: assessment.assessment_id.startsWith('assess-')
        ? undefined
        : assessment.assessment_id,
      user_id: userId,
      course_id: authorizedContext?.course_id || null,
      lesson_id: authorizedContext?.lesson_id || null,
      topic: safetyEval.sanitizedQuery,
      level: dto.level || 'BEGINNER',
      language,
      questions: assessment.questions,
      total_questions: assessment.questions.length,
    });

    if (insertBuilder && typeof insertBuilder.select === 'function') {
      const { data: persisted, error } = await insertBuilder.select('id, created_at').single();
      if (error) {
        this.logger.warn(`Could not persist assessment: ${error.message}`);
      } else if (persisted?.id) {
        assessment.assessment_id = persisted.id;
        if (persisted.created_at) {
          assessment.created_at = persisted.created_at;
        }
      }
    } else {
      const res = await insertBuilder;
      if (res?.error) {
        this.logger.warn(`Could not persist assessment: ${res.error.message}`);
      }
    }

    return assessment;
  }

  /**
   * Lists past knowledge check assessments for the authenticated learner.
   */
  async getAssessmentHistory(
    userId: string,
    courseId?: string,
    accessToken?: string
  ): Promise<AiAssessmentSummary[]> {
    const client = this.databaseService.getClient(accessToken);

    let query: any = client
      .from('ai_assessments')
      .select('id, course_id, lesson_id, topic, level, language, score, total_questions, percentage, passed, completed_at, created_at')
      .eq('user_id', userId);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(25);
    if (error) {
      this.logger.error(`Failed to load assessment history: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve assessment history.');
    }

    return (data || []) as AiAssessmentSummary[];
  }

  /**
   * Evaluates student submitted answers and computes mastery results.
   * Rejects duplicate submissions to protect SM-2 mastery integrity.
   */
  async submitAssessment(
    userId: string,
    submission: SubmitAssessmentRequestDto,
    cachedAssessment?: AssessmentCheckResponseDto,
    accessToken?: string
  ): Promise<SubmitAssessmentResultDto> {
    const client = this.databaseService.getClient(accessToken);

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
      if (record.completed_at) {
        throw new BadRequestException(
          'This assessment has already been submitted and graded.'
        );
      }

      assessment = {
        assessment_id: record.id,
        course_id: record.course_id,
        topic: record.topic,
        level: record.level,
        questions: record.questions,
        created_at: record.created_at,
      } as any;
    }

    if (!assessment) {
      throw new NotFoundException(`Assessment '${submission.assessment_id}' could not be loaded.`);
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

    // Update concept mastery records with SM-2 spaced-repetition algorithm
    if (result.detailed_feedback && result.detailed_feedback.length > 0) {
      await this.recordConceptMastery(
        client,
        userId,
        (assessment as any)?.course_id || null,
        result.detailed_feedback
      );
    }

    return result;
  }

  /**
   * Updates learner concept mastery using the SM-2 spaced repetition algorithm
   * based on actual assessment submission feedback.
   */
  private async recordConceptMastery(
    client: ReturnType<DatabaseService['getClient']>,
    userId: string,
    courseId: string | null | undefined,
    feedback: Array<{ concept_tag: string; is_correct: boolean }>
  ): Promise<void> {
    // Group feedback by concept_tag
    const conceptMap = new Map<string, { total: number; correct: number }>();
    for (const item of feedback) {
      if (!item.concept_tag) continue;
      const tag = item.concept_tag.trim();
      const current = conceptMap.get(tag) || { total: 0, correct: 0 };
      current.total += 1;
      if (item.is_correct) current.correct += 1;
      conceptMap.set(tag, current);
    }

    for (const [tag, stats] of conceptMap.entries()) {
      try {
        const { data: existing } = await client
          .from('learner_concept_mastery')
          .select('*')
          .eq('user_id', userId)
          .eq('concept_tag', tag)
          .maybeSingle();

        const passRate = stats.correct / stats.total;
        // Quality rating q in 0..5 scale for SM-2
        let q = 1;
        if (passRate >= 0.9) q = 5;
        else if (passRate >= 0.7) q = 4;
        else if (passRate >= 0.5) q = 3;
        else if (passRate >= 0.2) q = 2;

        let easeFactor = existing ? Number(existing.ease_factor) : 2.5;
        let repetitionCount = existing ? existing.repetition_count : 0;
        let reviewIntervalDays = existing ? existing.review_interval_days : 1;
        const attemptsCount = (existing ? existing.attempts_count : 0) + stats.total;
        const correctCount = (existing ? existing.correct_count : 0) + stats.correct;

        // SM-2 Interval Calculation
        if (q >= 3) {
          if (repetitionCount === 0) {
            reviewIntervalDays = 1;
          } else if (repetitionCount === 1) {
            reviewIntervalDays = 6;
          } else {
            reviewIntervalDays = Math.max(1, Math.round(reviewIntervalDays * easeFactor));
          }
          repetitionCount += 1;
        } else {
          repetitionCount = 0;
          reviewIntervalDays = 1;
        }

        // Update Ease Factor bounded strictly within [1.30, 5.00] to stay safe in numeric(3,2)
        easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        easeFactor = Math.min(5.0, Math.max(1.3, easeFactor));
        easeFactor = Number(easeFactor.toFixed(2));

        // Calculate mastery_score between 0.0 and 1.0 (70% accuracy, 30% repetition depth)
        const accuracy = attemptsCount > 0 ? correctCount / attemptsCount : 0;
        const depthBonus = Math.min(0.3, repetitionCount * 0.1);
        let masteryScore = Math.min(1.0, Math.max(0.0, accuracy * 0.7 + depthBonus));
        masteryScore = Number(masteryScore.toFixed(2));

        // Determine Status
        let status: 'LEARNING' | 'REVIEWING' | 'MASTERED' | 'NEEDS_REVISION' = 'LEARNING';
        if (q < 3 || masteryScore < 0.5) {
          status = 'NEEDS_REVISION';
        } else if (masteryScore >= 0.85 && repetitionCount >= 3) {
          status = 'MASTERED';
        } else if (repetitionCount >= 1) {
          status = 'REVIEWING';
        }

        const now = new Date();
        const nextReviewDate = new Date(
          now.getTime() + reviewIntervalDays * 24 * 60 * 60 * 1000
        );

        if (existing) {
          await client
            .from('learner_concept_mastery')
            .update({
              course_id: courseId || existing.course_id,
              mastery_score: masteryScore,
              attempts_count: attemptsCount,
              correct_count: correctCount,
              last_evaluated_at: now.toISOString(),
              next_review_due_at: nextReviewDate.toISOString(),
              review_interval_days: reviewIntervalDays,
              ease_factor: easeFactor,
              repetition_count: repetitionCount,
              status,
              updated_at: now.toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await client.from('learner_concept_mastery').insert({
            user_id: userId,
            course_id: courseId || null,
            concept_tag: tag,
            mastery_score: masteryScore,
            attempts_count: attemptsCount,
            correct_count: correctCount,
            last_evaluated_at: now.toISOString(),
            next_review_due_at: nextReviewDate.toISOString(),
            review_interval_days: reviewIntervalDays,
            ease_factor: easeFactor,
            repetition_count: repetitionCount,
            status,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to update concept mastery for '${tag}': ${err?.message}`);
      }
    }
  }

  /**
   * Retrieves personalized adaptive learning recommendations and concept mastery tracking.
   */
  async getAdaptiveRecommendations(
    userId: string,
    accessToken?: string
  ): Promise<AdaptiveRecommendationsDto> {
    const client = this.databaseService.getClient(accessToken);

    const { data: records, error } = await client
      .from('learner_concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .order('next_review_due_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to load concept mastery for ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to load adaptive learning data.');
    }

    const items: ConceptMasteryRecord[] = records || [];
    const totalConcepts = items.length;

    let overallMastery = 0;
    if (totalConcepts > 0) {
      const sum = items.reduce((acc, curr) => acc + Number(curr.mastery_score), 0);
      overallMastery = Math.round((sum / totalConcepts) * 100);
    }

    const now = new Date();
    const knowledgeGaps = items.filter(
      (r) => r.status === 'NEEDS_REVISION' || Number(r.mastery_score) < 0.6
    );
    const dueReviews = items.filter((r) => new Date(r.next_review_due_at) <= now);
    const masteredConcepts = items.filter(
      (r) => r.status === 'MASTERED' || Number(r.mastery_score) >= 0.85
    );

    const recommendedActions: AdaptiveRecommendationsDto['recommended_actions'] = [];

    // Prioritize critical knowledge gaps
    for (const gap of knowledgeGaps.slice(0, 2)) {
      recommendedActions.push({
        type: 'REVISE_CONCEPT',
        concept_tag: gap.concept_tag,
        course_id: gap.course_id || undefined,
        title: `Strengthen Concept: ${gap.concept_tag}`,
        reason: `Mastery score is ${Math.round(Number(gap.mastery_score) * 100)}%. Core concepts require targeted review.`,
        priority: 'HIGH',
      });
    }

    // Next, due spaced repetition reviews
    for (const due of dueReviews.slice(0, 2)) {
      if (recommendedActions.some((a) => a.concept_tag === due.concept_tag)) continue;
      recommendedActions.push({
        type: 'PRACTICE_ASSESSMENT',
        concept_tag: due.concept_tag,
        course_id: due.course_id || undefined,
        title: `Spaced Repetition Review: ${due.concept_tag}`,
        reason: `Memory decay interval reached. A quick practice check will reinforce retention.`,
        priority: 'MEDIUM',
      });
    }

    // Default action if on track
    if (recommendedActions.length === 0) {
      recommendedActions.push({
        type: 'PROCEED_LESSON',
        title: 'Maintain Learning Momentum',
        reason:
          totalConcepts === 0
            ? 'Take your first lesson knowledge check to begin personalized mastery tracking.'
            : 'You are on track with high retention across all active concepts.',
        priority: 'LOW',
      });
    }

    return {
      learner_id: userId,
      overall_mastery_percentage: overallMastery,
      total_concepts_tracked: totalConcepts,
      knowledge_gaps: knowledgeGaps,
      due_reviews: dueReviews,
      mastered_concepts: masteredConcepts,
      recommended_actions: recommendedActions,
    };
  }
}
