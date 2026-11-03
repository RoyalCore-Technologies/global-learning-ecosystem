import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateProgressDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Toggle lesson completion state (true for completed, false for incomplete)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_completed?: boolean = true;
}
