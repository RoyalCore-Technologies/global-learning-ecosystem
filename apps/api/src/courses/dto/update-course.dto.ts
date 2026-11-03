import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  Matches,
} from 'class-validator';
import type { CourseLevel, ContentTier } from '@platform/types';

export class UpdateCourseDto {
  @ApiPropertyOptional({ example: 'Distributed Systems Architecture: Consensus & Consistency' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'distributed-systems-architecture' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug may only contain lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Updated master summary.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ example: 'Updated course description...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'],
  })
  @IsOptional()
  @IsEnum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'])
  level?: CourseLevel;

  @ApiPropertyOptional({
    enum: ['FREE', 'PREMIUM'],
  })
  @IsOptional()
  @IsEnum(['FREE', 'PREMIUM'])
  tier?: ContentTier;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_cents?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @ApiPropertyOptional({ example: 'https://cdn.learnova.edu/thumbnails/distributed-v2.jpg' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;
}
