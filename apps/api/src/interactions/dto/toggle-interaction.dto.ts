import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import type { InteractionType } from '@platform/types';

export class ToggleInteractionDto {
  @ApiProperty({
    enum: ['UPVOTE_INSIGHTFUL', 'ENDORSE_ACCURACY'],
    example: 'UPVOTE_INSIGHTFUL',
    description: 'Type of peer interaction (academic accuracy endorsement or insightful vote)',
  })
  @IsNotEmpty()
  @IsEnum(['UPVOTE_INSIGHTFUL', 'ENDORSE_ACCURACY'])
  type: InteractionType;
}
