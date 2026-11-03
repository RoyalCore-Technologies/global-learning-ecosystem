import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
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

export class CreateLessonDto {
  @ApiProperty({ example: '1.1 System Models: Synchrony, Asynchrony & FLP Impossibility' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: '1-1-system-models-flp' })
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

  @ApiProperty({ example: 'In this lecture, we formalize the boundary between synchronous and asynchronous consensus...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'https://cdn.learnova.edu/lectures/flp-proof.mp4' })
  @IsString()
  @IsOptional()
  video_url?: string;

  @ApiPropertyOptional({ example: 45, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration_minutes?: number = 0;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_preview?: boolean = false;

  @ApiPropertyOptional({
    description: 'Timestamped lecture transcript segments',
    example: [{ timestamp_sec: 0, label: '00:00', text: 'Welcome to the course' }],
  })
  @IsOptional()
  @IsArray()
  transcript?: TranscriptSegment[];

  @ApiPropertyOptional({
    description: 'Interactive Code Lab playground configuration',
    example: { language: 'rust', starter_code: 'fn main() {}' },
  })
  @IsOptional()
  code_lab?: CodeLab;

  @ApiPropertyOptional({
    description: 'Downloadable lesson slides and research materials',
    example: [{ title: 'Lecture Slides PDF', url: 'https://...', type: 'SLIDES' }],
  })
  @IsOptional()
  @IsArray()
  resources?: LessonResource[];
}
