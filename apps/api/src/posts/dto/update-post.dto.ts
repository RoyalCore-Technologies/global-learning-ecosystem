import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
} from 'class-validator';
import type { PostType, PostStatus } from '@platform/types';

export class UpdatePostDto {
  @ApiPropertyOptional({ example: 'Updated Title on Byzantine Fault Tolerance' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(250)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated summary description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ example: '## Revised Post Content' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    enum: ['ARTICLE', 'TUTORIAL', 'QUESTION', 'SNIPPET', 'PROJECT_SHOWCASE'],
  })
  @IsOptional()
  @IsEnum(['ARTICLE', 'TUTORIAL', 'QUESTION', 'SNIPPET', 'PROJECT_SHOWCASE'])
  type?: PostType;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: PostStatus;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-123' })
  @IsString()
  @IsOptional()
  cover_image_url?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_pinned?: boolean;

  @ApiPropertyOptional({ example: ['rust', 'consensus'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
