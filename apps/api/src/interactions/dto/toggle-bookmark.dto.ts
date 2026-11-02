import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ToggleBookmarkDto {
  @ApiPropertyOptional({ example: 'Distributed Systems', default: 'Reading List' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  collection_name?: string;

  @ApiPropertyOptional({ example: 'Review sections 3 and 4 before implementing state machine.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
