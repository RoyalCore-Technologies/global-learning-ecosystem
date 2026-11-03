import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type { PostType } from '@platform/types';

export class FeedQueryDto {
  @ApiPropertyOptional({
    description: 'Feed ranking strategy',
    enum: ['recent', 'endorsed', 'following'],
    default: 'recent',
  })
  @IsOptional()
  @IsEnum(['recent', 'endorsed', 'following'])
  feed?: 'recent' | 'endorsed' | 'following' = 'recent';

  @ApiPropertyOptional({
    description: 'Filter by educational format',
    enum: ['ARTICLE', 'TUTORIAL', 'QUESTION', 'SNIPPET', 'PROJECT_SHOWCASE'],
  })
  @IsOptional()
  @IsEnum(['ARTICLE', 'TUTORIAL', 'QUESTION', 'SNIPPET', 'PROJECT_SHOWCASE'])
  type?: PostType;

  @ApiPropertyOptional({ description: 'Filter by discipline or topic tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by community ID' })
  @IsOptional()
  @IsString()
  community_id?: string;

  @ApiPropertyOptional({ description: 'Filter by creator channel ID' })
  @IsOptional()
  @IsString()
  channel_id?: string;

  @ApiPropertyOptional({ description: 'Filter by author user ID' })
  @IsOptional()
  @IsString()
  author_id?: string;

  @ApiPropertyOptional({ description: 'Full-text search query across title, summary and content' })
  @IsOptional()
  @IsString()
  search?: string;

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
