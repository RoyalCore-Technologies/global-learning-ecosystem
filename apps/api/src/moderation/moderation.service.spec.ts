import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModerationService } from './moderation.service.js';
import { DatabaseService } from '../database/database.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ModerationService', () => {
  let service: ModerationService;
  let mockDatabaseService: DatabaseService;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = {
      from: vi.fn(),
    };

    mockDatabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
      getAdminClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as DatabaseService;

    service = new ModerationService(mockDatabaseService);
  });

  describe('createReport', () => {
    it('throws BadRequestException when user attempts to report their own user account', async () => {
      await expect(
        service.createReport('user-1', {
          target_type: 'USER',
          target_id: 'user-1',
          reason: 'Self report attempt',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when duplicate pending report exists', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-rep-1' } }),
                }),
              }),
            }),
          }),
        }),
      });

      await expect(
        service.createReport('reporter-1', {
          target_type: 'POST',
          target_id: 'post-1',
          reason: 'Academic fraud',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('submits a new report when no pending report exists', async () => {
      const createdReport = {
        id: 'rep-new-1',
        reporter_id: 'reporter-1',
        target_type: 'POST',
        target_id: 'post-1',
        status: 'PENDING',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdReport, error: null }),
          }),
        }),
      });

      const res = await service.createReport('reporter-1', {
        target_type: 'POST',
        target_id: 'post-1',
        reason: 'Contains plagiarism',
      });

      expect(res.id).toBe('rep-new-1');
      expect(res.status).toBe('PENDING');
    });
  });

  describe('resolveReport', () => {
    it('throws NotFoundException when report does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      await expect(
        service.resolveReport('unknown-rep', 'admin-1', { status: 'RESOLVED' })
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves report, executes content removal action, and logs system audit record', async () => {
      const existingReport = {
        id: 'rep-1',
        target_type: 'POST',
        target_id: 'abusive-post-id',
        status: 'PENDING',
      };

      const updatedReport = {
        ...existingReport,
        status: 'RESOLVED',
        resolved_by: 'admin-1',
      };

      const postUpdateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const auditInsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'reports') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingReport, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            update: postUpdateMock,
          };
        }
        if (table === 'system_audit_logs') {
          return {
            insert: auditInsertMock,
          };
        }
        return {};
      });

      const res = await service.resolveReport('rep-1', 'admin-1', {
        status: 'RESOLVED',
        action: 'REMOVE_CONTENT',
        resolution_notes: 'Confirmed code plagiarism.',
      });

      expect(res.status).toBe('RESOLVED');
      expect(postUpdateMock).toHaveBeenCalledWith({ status: 'REMOVED' });
      expect(auditInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESOLVE_MODERATION_REPORT',
          performed_by: 'admin-1',
        })
      );
    });
  });
});
