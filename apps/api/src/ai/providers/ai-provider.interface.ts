import type {
  AiQueryRequestDto,
  AiQueryResponseDto,
  AssessmentCheckRequestDto,
  AssessmentCheckResponseDto,
  SubmitAssessmentRequestDto,
  SubmitAssessmentResultDto,
} from '@platform/types';

export interface AiProvider {
  readonly providerName: string;
  readonly defaultModel: string;

  generateExplanation(
    request: AiQueryRequestDto,
    learnerLevel: string
  ): Promise<AiQueryResponseDto>;

  generateExplanationStream?(
    request: AiQueryRequestDto,
    learnerLevel: string,
    onDelta: (chunk: string) => void
  ): Promise<AiQueryResponseDto>;

  generateAssessment(
    request: AssessmentCheckRequestDto
  ): Promise<AssessmentCheckResponseDto>;

  gradeAssessment(
    submission: SubmitAssessmentRequestDto,
    assessment: AssessmentCheckResponseDto
  ): Promise<SubmitAssessmentResultDto>;
}
