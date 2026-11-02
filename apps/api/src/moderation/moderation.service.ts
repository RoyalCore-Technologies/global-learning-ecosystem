import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CreateReportDto } from './dto/create-report.dto.js';
import type { ResolveReportDto } from './dto/resolve-report.dto.js';
import type { Report, ReportStatus } from '@platform/types';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Submits an abuse, misinformation, or academic misconduct report.
   * Enforces deduplication and self-reporting prohibitions.
   */
  async createReport(reporterId: string, dto: CreateReportDto): Promise<Report> {
    if (dto.target_type === 'USER' && dto.target_id === reporterId) {
      throw new BadRequestException('Scholars cannot file reports against their own account.');
    }

    const client = this.databaseService.getClient();

    // Check for existing pending report from this reporter
    const { data: existingReport } = await client
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('target_type', dto.target_type)
      .eq('target_id', dto.target_id)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingReport) {
      throw new BadRequestException(
        'You have already submitted an active report for this content. Our moderation team is currently reviewing it.'
      );
    }

    const { data: newReport, error: insertErr } = await client
      .from('reports')
      .insert({
        reporter_id: reporterId,
        target_type: dto.target_type,
        target_id: dto.target_id,
        reason: dto.reason.trim(),
        status: 'PENDING',
      })
      .select()
      .single();

    if (insertErr || !newReport) {
      this.logger.error(`Failed to submit report: ${insertErr?.message}`);
      throw new InternalServerErrorException('Failed to submit moderation report.');
    }

    return newReport as Report;
  }

  /**
   * Retrieves paginated moderation report queue (administrator only).
   */
  async getReportsQueue(
    page: number = 1,
    limit: number = 20,
    status?: ReportStatus
  ): Promise<{ data: Report[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = client
      .from('reports')
      .select('*, reporter:reporter_id(id, username, display_name, avatar_url)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reports, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to fetch moderation queue: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve moderation queue.');
    }

    return {
      data: (reports || []) as Report[],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Resolves a moderation report and executes automated auditable enforcement actions (administrator only).
   */
  async resolveReport(
    reportId: string,
    adminId: string,
    dto: ResolveReportDto
  ): Promise<Report> {
    const client = this.databaseService.getClient();

    const { data: report, error: findErr } = await client
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (findErr || !report) {
      throw new NotFoundException('Report not found.');
    }

    // 1. Update report resolution record
    const { data: updatedReport, error: updateErr } = await client
      .from('reports')
      .update({
        status: dto.status,
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
        resolution_notes: dto.resolution_notes?.trim() || null,
      })
      .eq('id', reportId)
      .select()
      .single();

    if (updateErr || !updatedReport) {
      this.logger.error(`Failed to resolve report: ${updateErr?.message}`);
      throw new InternalServerErrorException('Failed to update report resolution.');
    }

    // 2. Execute enforcement action if requested
    if (dto.action === 'REMOVE_CONTENT') {
      if (report.target_type === 'POST') {
        await client.from('posts').update({ status: 'REMOVED' }).eq('id', report.target_id);
      } else if (report.target_type === 'COMMENT') {
        await client.from('comments').delete().eq('id', report.target_id);
      }
    } else if (dto.action === 'BAN_USER') {
      if (report.target_type === 'USER') {
        await client.from('profiles').update({ is_banned: true }).eq('id', report.target_id);
      }
    }

    // 3. Write immutable forensic system audit record
    await client.from('system_audit_logs').insert({
      action: 'RESOLVE_MODERATION_REPORT',
      entity_type: report.target_type,
      entity_id: report.target_id,
      performed_by: adminId,
      payload: {
        report_id: reportId,
        status: dto.status,
        action: dto.action || 'NONE',
        notes: dto.resolution_notes || null,
      },
    });

    return updatedReport as Report;
  }
}
