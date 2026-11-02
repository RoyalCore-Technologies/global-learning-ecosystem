import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReportStatus } from '@platform/types';

export class ResolveReportDto {
  @ApiProperty({
    enum: ['RESOLVED', 'DISMISSED'],
    example: 'RESOLVED',
  })
  @IsNotEmpty()
  @IsEnum(['RESOLVED', 'DISMISSED'])
  status: ReportStatus;

  @ApiPropertyOptional({
    example: 'Verified plagiarism against published arXiv paper. Post taken down and author warned.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution_notes?: string;

  @ApiPropertyOptional({
    enum: ['NONE', 'REMOVE_CONTENT', 'BAN_USER'],
    default: 'NONE',
    description: 'Automated administrative enforcement action to execute upon resolution',
  })
  @IsOptional()
  @IsEnum(['NONE', 'REMOVE_CONTENT', 'BAN_USER'])
  action?: 'NONE' | 'REMOVE_CONTENT' | 'BAN_USER' = 'NONE';
}
