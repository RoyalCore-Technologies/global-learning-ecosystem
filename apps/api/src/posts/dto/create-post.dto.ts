import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  Matches,
} from 'class-validator';
import type { PostType, PostStatus } from '@platform/types';

export class CreatePostDto {
  @ApiProperty({ example: 'Byzantine Fault Tolerance in Rust' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(250)
  title: string;

  @ApiPropertyOptional({ example: 'byzantine-fault-tolerance-in-rust' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug may only contain lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'A comprehensive deep dive into distributed consensus mechanisms.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @ApiProperty({ example: '## Introduction to PBFT\n\nPractical Byzantine Fault Tolerance...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    enum: ['ARTICLE', 'TUTORIAL', 'QUESTION', 'SNIPPET', 'PROJECT_SHOWCASE'],
    default: 'ARTICLE',
  })
  @IsOptional()
  @IsEnum(['ARTICLE', 'TUTORIAL', 'QUESTION', 'SNIPPET', 'PROJECT_SHOWCASE'])
  type?: PostType = 'ARTICLE';

  @ApiPropertyOptional({
    enum: ['DRAFT', 'PUBLISHED'],
    default: 'PUBLISHED',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'PUBLISHED'])
  status?: PostStatus = 'PUBLISHED';

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-123' })
  @IsString()
  @IsOptional()
  cover_image_url?: string;

  @ApiPropertyOptional({ example: ['rust', 'distributed-systems', 'consensus'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: '11111111-1111-1111-1111-111111111111' })
  @IsString()
  @IsOptional()
  community_id?: string;

  @ApiPropertyOptional({ example: '22222222-2222-2222-2222-222222222222' })
  @IsString()
  @IsOptional()
  channel_id?: string;
}
