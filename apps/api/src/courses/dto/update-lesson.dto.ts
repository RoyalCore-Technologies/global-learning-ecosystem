import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  Matches,
} from 'class-validator';
import type { TranscriptSegment, CodeLab, LessonResource } from '@platform/types';

export class UpdateLessonDto {
  @ApiPropertyOptional({ example: '1.1 System Models: Synchrony & Asynchrony' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '1-1-system-models' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug may only contain lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;

  @ApiPropertyOptional({ example: 'Updated lecture content...' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: 'https://cdn.learnova.edu/lectures/flp-proof-v2.mp4' })
  @IsString()
  @IsOptional()
  video_url?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_preview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  transcript?: TranscriptSegment[];

  @ApiPropertyOptional()
  @IsOptional()
  code_lab?: CodeLab;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  resources?: LessonResource[];
}
