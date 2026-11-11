import { Injectable } from '@nestjs/common';
import type {
  AiInteractionContext,
  AiSafetyCategory,
  LearningAgeGroup,
} from '@platform/types';

export interface SafetyEvaluationResult {
  allowed: boolean;
  sanitizedQuery: string;
  sanitizedContext?: AiInteractionContext;
  category: AiSafetyCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: 'NONE' | 'BLOCKED' | 'REDACTED' | 'GUIDED_REDIRECT';
  forceSocratic: boolean;
  piiRedacted: boolean;
  userMessage?: string;
}

const SUPPORTED_LANGUAGES = new Set([
  'en',
  'es',
  'fr',
  'de',
  'hi',
  'te',
  'zh',
  'ar',
  'ja',
  'pt',
]);

@Injectable()
export class AiSafetyService {
  private readonly injectionPatterns: RegExp[] = [
    /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i,
    /disregard\s+(all\s+|your\s+)?(instructions?|system\s+prompt|safety)/i,
    /(reveal|show|print|repeat|dump|leak)\s+(your\s+|the\s+)?(system\s+prompt|hidden\s+instructions?|api\s+key|secret)/i,
    /\b(jailbreak|dan\s+mode|developer\s+mode|god\s+mode)\b/i,
    /<\|?(system|im_start|endoftext)\|?>/i,
    /bypass\s+(safety|guardrails|content\s+filter|restrictions)/i,
  ];

  private readonly unsafeContentPatterns: RegExp[] = [
    /\b(how\s+to\s+(make|build|synthesize)\s+(a\s+)?(bomb|explosive|nerve\s+agent|bioweapon|meth|fentanyl))\b/i,
    /\b(suicide\s+methods|how\s+to\s+kill\s+myself|self[\s-]harm\s+instructions)\b/i,
    /\b(ransomware\s+payload|exploit\s+zero[\s-]day\s+for\s+attack|steal\s+credit\s+cards)\b/i,
    /\b(explicit\s+sexual|pornograph|csam)\b/i,
  ];

  private readonly cheatingPatterns: RegExp[] = [
    /\b(just\s+give\s+me\s+the\s+(final\s+)?answers?\s+(only|without\s+explan)|complete\s+my\s+(graded\s+)?(exam|quiz|homework)\s+for\s+me)\b/i,
    /\b(do\s+my\s+assignment\s+so\s+i\s+can\s+(just\s+)?submit|skip\s+the\s+explanation\s+and\s+give\s+answers?)\b/i,
  ];

  normalizeLanguage(language?: string): string {
    if (!language) return 'en';
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGUAGES.has(base) ? base : 'en';
  }

  normalizeAgeGroup(ageGroup?: string): LearningAgeGroup {
    if (ageGroup === 'CHILD' || ageGroup === 'TEEN' || ageGroup === 'ADULT') {
      return ageGroup;
    }
    return 'ADULT';
  }

  redactPii(input: string): { text: string; redacted: boolean } {
    let text = input;
    let redacted = false;

    const replacements: Array<[RegExp, string]> = [
      // Email addresses
      [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]'],
      // API keys / JWTs / Bearer tokens
      [/\b(AIza[0-9A-Za-z\-_]{20,}|sk-[0-9A-Za-z]{16,}|eyJ[0-9A-Za-z\-_]+\.[0-9A-Za-z\-_]+\.[0-9A-Za-z\-_]+)\b/g, '[REDACTED_CREDENTIAL]'],
      // Phone numbers (international or US-like formats with at least 10 digits)
      [/(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[REDACTED_PHONE]'],
      // SSN-like numbers
      [/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_GOV_ID]'],
    ];

    for (const [pattern, token] of replacements) {
      if (pattern.test(text)) {
        redacted = true;
        text = text.replace(pattern, token);
      }
    }

    return { text, redacted };
  }

  evaluateAndSanitizeInput(
    query: string,
    context?: AiInteractionContext
  ): SafetyEvaluationResult {
    const trimmed = query.trim();

    // 1. Prompt injection detection
    if (this.injectionPatterns.some((re) => re.test(trimmed))) {
      return {
        allowed: false,
        sanitizedQuery: '',
        category: 'PROMPT_INJECTION',
        severity: 'HIGH',
        action: 'BLOCKED',
        forceSocratic: false,
        piiRedacted: false,
        userMessage:
          'This request appears to alter system instructions or bypass educational safeguards. Please ask a direct academic question related to your coursework.',
      };
    }

    // 2. Harmful / Age-inappropriate content filter
    if (this.unsafeContentPatterns.some((re) => re.test(trimmed))) {
      return {
        allowed: false,
        sanitizedQuery: '',
        category: 'UNSAFE_CONTENT',
        severity: 'CRITICAL',
        action: 'BLOCKED',
        forceSocratic: false,
        piiRedacted: false,
        userMessage:
          'Learnova cannot assist with harmful, unsafe, or non-educational content. If you are experiencing distress, please seek support from a trusted educator, guardian, or local helpline.',
      };
    }

    // 3. Redact PII from query and context before persistence or LLM forwarding
    const queryRedaction = this.redactPii(trimmed);
    let piiRedacted = queryRedaction.redacted;

    const sanitizedContext: AiInteractionContext | undefined = context
      ? {
          ...context,
          preferred_language: this.normalizeLanguage(context.preferred_language),
          age_group: this.normalizeAgeGroup(context.age_group),
        }
      : undefined;

    if (sanitizedContext?.lesson_content) {
      const contentRedaction = this.redactPii(sanitizedContext.lesson_content);
      sanitizedContext.lesson_content = contentRedaction.text.slice(0, 4000);
      if (contentRedaction.redacted) piiRedacted = true;
    }

    if (sanitizedContext?.code_context?.student_code) {
      const codeRedaction = this.redactPii(sanitizedContext.code_context.student_code);
      sanitizedContext.code_context = {
        ...sanitizedContext.code_context,
        student_code: codeRedaction.text.slice(0, 4000),
      };
      if (codeRedaction.redacted) piiRedacted = true;
    }

    // 4. Academic integrity check — pivot to Socratic guidance instead of raw answers
    const isCheating = this.cheatingPatterns.some((re) => re.test(queryRedaction.text));
    if (isCheating) {
      return {
        allowed: true,
        sanitizedQuery: queryRedaction.text,
        sanitizedContext,
        category: 'ACADEMIC_DISHONESTY',
        severity: 'MEDIUM',
        action: 'GUIDED_REDIRECT',
        forceSocratic: true,
        piiRedacted,
      };
    }

    return {
      allowed: true,
      sanitizedQuery: queryRedaction.text,
      sanitizedContext,
      category: piiRedacted ? 'PII_REDACTED' : 'SAFE',
      severity: 'LOW',
      action: piiRedacted ? 'REDACTED' : 'NONE',
      forceSocratic: false,
      piiRedacted,
    };
  }
}
