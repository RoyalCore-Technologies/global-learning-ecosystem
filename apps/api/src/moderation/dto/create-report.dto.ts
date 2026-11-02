import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { ReportTarget } from '@platform/types';

export class CreateReportDto {
  @ApiProperty({
    enum: ['POST', 'COMMENT', 'USER', 'COMMUNITY'],
    example: 'POST',
    description: 'Type of entity being reported for policy violation',
  })
  @IsNotEmpty()
  @IsEnum(['POST', 'COMMENT', 'USER', 'COMMUNITY'])
  target_type: ReportTarget;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the target post, comment, user, or community',
  })
  @IsNotEmpty()
  @IsUUID()
  target_id: string;

  @ApiProperty({
    example: 'Contains academically fraudulent citation claims and plagiarism.',
    description: 'Detailed explanation of the safety or integrity violation',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}
