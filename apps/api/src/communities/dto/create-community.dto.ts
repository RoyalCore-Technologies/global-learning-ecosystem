import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({ example: 'Autonomous Systems & Robotics' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'autonomous-systems-robotics' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug may only contain lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Guild of roboticists and autonomous vehicle researchers.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/avatar-comm' })
  @IsString()
  @IsOptional()
  avatar_url?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/banner-comm' })
  @IsString()
  @IsOptional()
  banner_url?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_private?: boolean = false;
}
