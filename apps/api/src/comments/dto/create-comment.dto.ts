import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 'This derivation of the Byzantine consensus state transition is exceptionally rigorous.',
    description: 'Markdown content of the discussion comment',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    example: 'd9b2d63d-a233-4123-8472-123456789abc',
    description: 'UUID of the parent comment when creating a threaded reply',
  })
  @IsOptional()
  @IsUUID()
  parent_comment_id?: string;
}
