import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateModuleDto {
  @ApiPropertyOptional({ example: 'Module 1: Revised Foundations' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;
}
