import { describe, it, expect } from 'vitest';
import type {
  AiQueryRequestDto,
  AiQueryResponseDto,
  AssessmentCheckResponseDto,
  SubmitAssessmentResultDto,
} from './ai.js';

describe('Learnova M5 AI Learning Companion Types', () => {
  it('validates AI query request and response contracts', () => {
    const req: AiQueryRequestDto = {
      query: 'Explain consensus in distributed systems',
      mode: 'SOCRATIC',
      context: {
        course_title: 'Distributed Systems',
        learner_level: 'INTERMEDIATE',
      },
    };

    expect(req.mode).toBe('SOCRATIC');
    expect(req.context?.learner_level).toBe('INTERMEDIATE');

    const res: AiQueryResponseDto = {
      message_id: 'msg-1',
      text: 'What happens when a network partition divides your nodes?',
      mode: 'SOCRATIC',
      citations: ['Fischer, Lynch, Paterson (1985)'],
      follow_up_questions: ['Can you distinguish a crashed node from a slow network link?'],
      provider: 'anthropic',
      model: 'claude-3-7-sonnet',
      created_at: new Date().toISOString(),
    };

    expect(res.citations).toHaveLength(1);
    expect(res.follow_up_questions).toHaveLength(1);
  });

  it('validates knowledge-check assessment types and feedback contracts', () => {
    const assessment: AssessmentCheckResponseDto = {
      assessment_id: 'assess-1',
      topic: 'Raft Safety Invariants',
      level: 'ADVANCED',
      questions: [
        {
          id: 'q-1',
          prompt: 'What guarantees that two majorities in cluster size 2f + 1 intersect in at least one node?',
          options: [
            'The Pigeonhole Principle',
            'Byzantine General Consensus',
            'Vector Clock Monotonicity',
            'Lamport Timestamp Ordering',
          ],
          correct_option_index: 0,
          explanation: 'Any two majorities of 2f + 1 intersect by the Pigeonhole Principle.',
          concept_tag: 'quorum-intersection',
          difficulty: 'ADVANCED',
        },
      ],
      created_at: new Date().toISOString(),
    };

    expect(assessment.questions).toHaveLength(1);
    expect(assessment.questions[0].correct_option_index).toBe(0);

    const result: SubmitAssessmentResultDto = {
      score: 1,
      total_questions: 1,
      percentage: 100,
      passed: true,
      detailed_feedback: [
        {
          question_id: 'q-1',
          is_correct: true,
          explanation: assessment.questions[0].explanation,
          concept_tag: 'quorum-intersection',
        },
      ],
      next_recommended_step: 'Proceed to Raft Log Compaction & Snapshotting',
    };

    expect(result.passed).toBe(true);
    expect(result.percentage).toBe(100);
  });

  it('validates adaptive learning mastery records and recommendations contracts (M5.4)', () => {
    const masteryRecord = {
      id: 'mast-1',
      user_id: 'user-1',
      concept_tag: 'quorum-intersection',
      mastery_score: 0.95,
      attempts_count: 5,
      correct_count: 5,
      last_evaluated_at: '2026-11-05T12:00:00Z',
      next_review_due_at: '2026-11-12T12:00:00Z',
      review_interval_days: 7,
      ease_factor: 2.6,
      repetition_count: 3,
      status: 'MASTERED' as const,
    };

    expect(masteryRecord.status).toBe('MASTERED');
    expect(masteryRecord.mastery_score).toBe(0.95);
    expect(masteryRecord.review_interval_days).toBe(7);
  });
});
