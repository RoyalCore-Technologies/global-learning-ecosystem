import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import type { CourseLevel, ContentTier } from '@platform/types';

export class CourseQueryDto {
  @ApiPropertyOptional({ description: 'Search term matching title or summary' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by difficulty level',
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'],
  })
  @IsOptional()
  @IsEnum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'])
  level?: CourseLevel;

  @ApiPropertyOptional({
    description: 'Filter by pricing tier',
    enum: ['FREE', 'PREMIUM'],
  })
  @IsOptional()
  @IsEnum(['FREE', 'PREMIUM'])
  tier?: ContentTier;

  @ApiPropertyOptional({ description: 'Filter by instructor profile ID' })
  @IsOptional()
  @IsUUID('4', { message: 'instructor_id must be a valid UUID' })
  instructor_id?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
