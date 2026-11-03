import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsInt, Min } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Module 1: Foundations of Fault-Tolerant Consensus' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;
}
