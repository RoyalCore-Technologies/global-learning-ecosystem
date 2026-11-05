import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { AcademicAiProvider } from './providers/academic-ai.provider.js';
import { DatabaseService } from '../database/database.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AiService (Milestone 5.3)', () => {
  let service: AiService;
  let mockDatabaseService: DatabaseService;
  let mockSupabaseClient: any;
  let provider: AcademicAiProvider;

  beforeEach(() => {
    mockSupabaseClient = {
      from: vi.fn(),
    };

    mockDatabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
      getAdminClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as DatabaseService;

    provider = new AcademicAiProvider();
    service = new AiService(mockDatabaseService, provider);
  });

  describe('processQuery', () => {
    it('initializes a new learning session and returns cognitive explanation', async () => {
      const mockSession = { id: 'sess-123' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_learning_sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'ai_learning_messages') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const res = await service.processQuery('user-1', {
        query: 'Derive Raft Leader Completeness proof',
        mode: 'PROOF',
        context: { learner_level: 'ADVANCED' },
      });

      expect(res.session_id).toBe('sess-123');
      expect(res.response.text).toContain('Leader Completeness');
      expect(res.response.citations.length).toBeGreaterThan(0);
      expect(res.response.follow_up_questions.length).toBeGreaterThan(0);
    });

    it('rejects access to another learner session', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'sess-123', user_id: 'other-user' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.processQuery('user-1', { query: 'Hello' }, 'sess-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateAssessment & submitAssessment', () => {
    it('generates assessment questions and persists record in database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const assessment = await service.generateAssessment('user-1', {
        topic: 'Raft Consensus Protocol',
        level: 'INTERMEDIATE',
      });

      expect(assessment.topic).toBe('Raft Consensus Protocol');
      expect(assessment.questions.length).toBeGreaterThan(0);
      expect(assessment.questions[0].options.length).toBeGreaterThan(1);
    });

    it('grades assessment submission and returns score and detailed feedback', async () => {
      const mockRecord = {
        id: 'assess-123',
        user_id: 'user-1',
        topic: 'Raft Consensus',
        level: 'INTERMEDIATE',
        questions: [
          {
            id: 'q-1',
            prompt: 'Question 1',
            options: ['Option A', 'Option B'],
            correct_option_index: 0,
            explanation: 'Explanation 1',
            concept_tag: 'quorum',
          },
        ],
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_assessments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockRecord, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const result = await service.submitAssessment('user-1', {
        assessment_id: 'assess-123',
        answers: [{ question_id: 'q-1', selected_option_index: 0 }],
      });

      expect(result.score).toBe(1);
      expect(result.total_questions).toBe(1);
      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.detailed_feedback[0].is_correct).toBe(true);
    });
  });
});
