import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
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

export class CreateCourseDto {
  @ApiProperty({ example: 'Distributed Systems Architecture: Consensus & Consistency' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'distributed-systems-architecture' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug may only contain lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Master state machine replication, Paxos, and Raft.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @ApiProperty({ example: 'Comprehensive 10-module deep dive into consensus protocols...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'],
    default: 'BEGINNER',
  })
  @IsOptional()
  @IsEnum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'])
  level?: CourseLevel = 'BEGINNER';

  @ApiPropertyOptional({
    enum: ['FREE', 'PREMIUM'],
    default: 'FREE',
  })
  @IsOptional()
  @IsEnum(['FREE', 'PREMIUM'])
  tier?: ContentTier = 'FREE';

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_cents?: number = 0;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_published?: boolean = false;

  @ApiPropertyOptional({ example: 'https://cdn.learnova.edu/thumbnails/distributed.jpg' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;
}
