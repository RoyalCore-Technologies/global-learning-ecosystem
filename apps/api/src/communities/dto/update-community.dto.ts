import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdateCommunityDto {
  @ApiPropertyOptional({ example: 'Autonomous Systems & Robotics Updated' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated guild description.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/avatar-comm-new' })
  @IsString()
  @IsOptional()
  avatar_url?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/banner-comm-new' })
  @IsString()
  @IsOptional()
  banner_url?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_private?: boolean;
}
