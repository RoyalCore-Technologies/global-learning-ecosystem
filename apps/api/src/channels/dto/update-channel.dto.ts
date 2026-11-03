import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class UpdateChannelDto {
  @ApiPropertyOptional({ example: 'Quantum Computing Laboratory Updated' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated channel description.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/channel-avatar-new' })
  @IsString()
  @IsOptional()
  avatar_url?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/channel-banner-new' })
  @IsString()
  @IsOptional()
  banner_url?: string;
}
