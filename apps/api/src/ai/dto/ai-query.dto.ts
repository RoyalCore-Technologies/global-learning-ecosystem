import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, MaxLength, MinLength, IsObject, IsArray } from 'class-validator';
import type { AiScaffoldingMode, LearnerLevel, AiInteractionContext } from '@platform/types';

export class QueryAiDto {
  @ApiProperty({
    example: 'Explain how FlashAttention avoids HBM roundtrips by tiling in SRAM.',
    description: 'The educational query or invariant analysis request',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  query: string;

  @ApiPropertyOptional({
    enum: ['SOCRATIC', 'PROOF', 'CODE_ANALYSIS', 'MASTERY', 'EXPLANATION'],
    default: 'EXPLANATION',
    description: 'Desired cognitive scaffolding mode',
  })
  @IsOptional()
  @IsEnum(['SOCRATIC', 'PROOF', 'CODE_ANALYSIS', 'MASTERY', 'EXPLANATION'])
  mode?: AiScaffoldingMode;

  @ApiPropertyOptional({
    description: 'Course, lesson, and learner context for targeted pedagogical scaffolding',
  })
  @IsOptional()
  @IsObject()
  context?: AiInteractionContext;

  @ApiPropertyOptional({
    description: 'Recent conversation history for multi-turn cognitive exploration',
  })
  @IsOptional()
  @IsArray()
  conversation_history?: Array<{
    sender: 'user' | 'ai';
    text: string;
  }>;
}

export class GenerateAssessmentDto {
  @ApiProperty({
    example: 'Raft Leader Completeness & Invariants',
    description: 'Subject or lesson concept topic to evaluate',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  topic: string;

  @ApiPropertyOptional({
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    default: 'INTERMEDIATE',
    description: 'Target learner level for question difficulty',
  })
  @IsOptional()
  @IsEnum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  level?: LearnerLevel;

  @ApiPropertyOptional({
    description: 'Course and lesson context for specific curriculum evaluation',
  })
  @IsOptional()
  @IsObject()
  context?: AiInteractionContext;
}

export class SubmitAssessmentDto {
  @ApiProperty({
    example: 'assess-123e4567',
    description: 'Identifier of the generated knowledge check assessment',
  })
  @IsNotEmpty()
  @IsString()
  assessment_id: string;

  @ApiProperty({
    description: 'User answers with question ID and selected option index',
    example: [{ question_id: 'q-1', selected_option_index: 0 }],
  })
  @IsNotEmpty()
  @IsArray()
  answers: Array<{
    question_id: string;
    selected_option_index: number;
  }>;
}
