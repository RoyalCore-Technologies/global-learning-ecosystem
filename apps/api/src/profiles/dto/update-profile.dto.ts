import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsArray,
  IsUrl,
  IsObject,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InAppPreferencesDto {
  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  comments?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  upvotes?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  endorsements?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  follows?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  system?: boolean;
}

export class EmailPreferencesDto {
  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  weekly_digest?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  major_announcements?: boolean;
}

export class NotificationPreferencesDto {
  @ApiPropertyOptional({ type: InAppPreferencesDto })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => InAppPreferencesDto)
  in_app?: InAppPreferencesDto;

  @ApiPropertyOptional({ type: EmailPreferencesDto })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailPreferencesDto)
  email?: EmailPreferencesDto;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Dr. Jane Doe' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  display_name?: string;

  @ApiPropertyOptional({ example: 'Quantum Computing Researcher at Oxford' })
  @IsString()
  @IsOptional()
  @MaxLength(160)
  headline?: string;

  @ApiPropertyOptional({ example: 'Investigating fault-tolerant quantum algorithms.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: ['quantum-computing', 'rust', 'python'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ example: 'https://github.com/janedoe' })
  @IsUrl({}, { message: 'github_url must be a valid URL' })
  @IsOptional()
  github_url?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/janedoe' })
  @IsUrl({}, { message: 'linkedin_url must be a valid URL' })
  @IsOptional()
  linkedin_url?: string;

  @ApiPropertyOptional({ example: 'https://janedoe.research.edu' })
  @IsUrl({}, { message: 'website_url must be a valid URL' })
  @IsOptional()
  website_url?: string;

  @ApiPropertyOptional({ type: NotificationPreferencesDto })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notification_preferences?: NotificationPreferencesDto;
}
