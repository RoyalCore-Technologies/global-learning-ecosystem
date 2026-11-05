export type AiScaffoldingMode = 'SOCRATIC' | 'PROOF' | 'CODE_ANALYSIS' | 'MASTERY' | 'EXPLANATION';

export type LearnerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  codeSnippet?: {
    code: string;
    language: string;
    filename?: string;
  } | null;
  citations?: string[];
  follow_up_questions?: string[];
  suggested_action?: string;
  timestamp: string;
}

export interface AiInteractionContext {
  course_id?: string;
  course_title?: string;
  module_id?: string;
  module_title?: string;
  lesson_id?: string;
  lesson_title?: string;
  lesson_content?: string;
  learner_level?: LearnerLevel;
  code_context?: {
    language: string;
    starter_code?: string;
    student_code?: string;
  };
}

export interface AiQueryRequestDto {
  query: string;
  mode?: AiScaffoldingMode;
  context?: AiInteractionContext;
  conversation_history?: Array<{
    sender: 'user' | 'ai';
    text: string;
  }>;
}

export interface AiQueryResponseDto {
  message_id: string;
  text: string;
  mode: AiScaffoldingMode;
  codeSnippet?: {
    code: string;
    language: string;
    filename?: string;
  } | null;
  citations: string[];
  follow_up_questions: string[];
  educational_assessment?: {
    topic: string;
    mastery_observed: boolean;
    feedback: string;
  } | null;
  provider: string;
  model: string;
  created_at: string;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  code_snippet?: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  concept_tag: string;
  difficulty: LearnerLevel;
}

export interface AssessmentCheckRequestDto {
  topic: string;
  level?: LearnerLevel;
  context?: AiInteractionContext;
  count?: number;
}

export interface AssessmentCheckResponseDto {
  assessment_id: string;
  topic: string;
  level: LearnerLevel;
  questions: AssessmentQuestion[];
  created_at: string;
}

export interface SubmitAssessmentRequestDto {
  assessment_id: string;
  answers: Array<{
    question_id: string;
    selected_option_index: number;
  }>;
}

export interface SubmitAssessmentResultDto {
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  detailed_feedback: Array<{
    question_id: string;
    is_correct: boolean;
    explanation: string;
    concept_tag: string;
  }>;
  next_recommended_step: string;
}
