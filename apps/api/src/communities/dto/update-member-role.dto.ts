import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import type { CommunityRole } from '@platform/types';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['MEMBER', 'MODERATOR', 'LEAD'], example: 'MODERATOR' })
  @IsNotEmpty()
  @IsEnum(['MEMBER', 'MODERATOR', 'LEAD'])
  role: CommunityRole;
}
