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
  AdaptiveRecommendationsDto,
  ConceptMasteryRecord,
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
    userId: string,
    courseId: string | null | undefined,
    feedback: Array<{ concept_tag: string; is_correct: boolean }>
  ): Promise<void> {
    const client = this.databaseService.getClient();

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

        let easeFactor = existing ? Number(existing.ease_factor) : 2.50;
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

        // Update Ease Factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        if (easeFactor < 1.30) easeFactor = 1.30;
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
        const nextReviewDate = new Date(now.getTime() + reviewIntervalDays * 24 * 60 * 60 * 1000);

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
  async getAdaptiveRecommendations(userId: string): Promise<AdaptiveRecommendationsDto> {
    const client = this.databaseService.getClient();

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
    const dueReviews = items.filter(
      (r) => new Date(r.next_review_due_at) <= now
    );
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
