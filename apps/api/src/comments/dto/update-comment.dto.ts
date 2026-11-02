import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    example: 'Updated explanation clarifying the commit phase edge condition.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}
