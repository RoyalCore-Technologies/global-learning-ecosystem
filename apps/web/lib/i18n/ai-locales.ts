import type { LearningAgeGroup } from '@platform/types';

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
}

export const AI_SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', dir: 'ltr' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', dir: 'ltr' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', dir: 'ltr' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', dir: 'ltr' },
];

export const AI_AGE_GROUPS: Array<{
  id: LearningAgeGroup;
  label: string;
  description: string;
}> = [
  {
    id: 'CHILD',
    label: 'Young Learner (8–12)',
    description: 'Simple analogies & strict youth safeguards',
  },
  {
    id: 'TEEN',
    label: 'Secondary / Teen (13–17)',
    description: 'Structured explanations & guided examples',
  },
  {
    id: 'ADULT',
    label: 'University / Adult',
    description: 'Full mathematical & architectural rigor',
  },
];

export interface AiUiStrings {
  companionTitle: string;
  askPlaceholder: string;
  aiNoticeBadge: string;
  fallbackBadge: string;
  liveBadge: string;
  sendLabel: string;
  cancelStreamLabel: string;
  knowledgeCheckLabel: string;
  adaptiveLabel: string;
}

const LOCALIZED_UI_STRINGS: Record<string, AiUiStrings> = {
  en: {
    companionTitle: 'Lesson AI Companion',
    askPlaceholder: 'Ask a question about this lesson, proofs, or invariants...',
    aiNoticeBadge: 'AI-Generated Guidance — Distinct from Verified Course Notes',
    fallbackBadge: 'Offline Academic Scaffold (Live LLM Unavailable)',
    liveBadge: 'Live Server-Side Model',
    sendLabel: 'Ask Companion',
    cancelStreamLabel: 'Stop',
    knowledgeCheckLabel: 'Lesson Knowledge Check',
    adaptiveLabel: 'View Mastery & SM-2',
  },
  es: {
    companionTitle: 'Compañero IA de Lección',
    askPlaceholder: 'Haz una pregunta sobre esta lección, demostraciones o invariantes...',
    aiNoticeBadge: 'Guía Generada por IA — Distinta de las Notas Verificadas',
    fallbackBadge: 'Andamiaje Académico Local (Modelo en Vivo No Disponible)',
    liveBadge: 'Modelo en Vivo',
    sendLabel: 'Enviar',
    cancelStreamLabel: 'Detener',
    knowledgeCheckLabel: 'Prueba de Conocimientos',
    adaptiveLabel: 'Ver Dominio y SM-2',
  },
  fr: {
    companionTitle: 'Compagnon IA de Cours',
    askPlaceholder: 'Posez une question sur cette leçon, les preuves ou les invariants...',
    aiNoticeBadge: 'Guidage IA — Distinct des Notes Vérifiées du Cours',
    fallbackBadge: 'Support Académique Local (Modèle en Direct Indisponible)',
    liveBadge: 'Modèle en Direct',
    sendLabel: 'Envoyer',
    cancelStreamLabel: 'Arrêter',
    knowledgeCheckLabel: 'Test de Connaissances',
    adaptiveLabel: 'Maîtrise & SM-2',
  },
  hi: {
    companionTitle: 'पाठ AI शिक्षण साथी',
    askPlaceholder: 'इस पाठ, प्रमेय या कोड के बारे में प्रश्न पूछें...',
    aiNoticeBadge: 'AI-जनित मार्गदर्शन — सत्यापित पाठ्यक्रम नोट्स से अलग',
    fallbackBadge: 'ऑफ़लाइन शैक्षणिक सहायता (लाइव मॉडल अनुपलब्ध)',
    liveBadge: 'लाइव मॉडल',
    sendLabel: 'पूछें',
    cancelStreamLabel: 'रोकें',
    knowledgeCheckLabel: 'पाठ ज्ञान जांच',
    adaptiveLabel: 'दक्षता और SM-2 देखें',
  },
  te: {
    companionTitle: 'పాఠం AI అభ్యాస సహాయకుడు',
    askPlaceholder: 'ఈ పాఠం లేదా సిద్ధాంతం గురించి ప్రశ్న అడగండి...',
    aiNoticeBadge: 'AI-ఆధారిత సూచన — ధృవీకరించబడిన కోర్సు నోట్స్ నుండి వేరుగా ఉంటుంది',
    fallbackBadge: 'ఆఫ్‌లైన్ విద్యా సహాయకం (లైవ్ మోడల్ అందుబాటులో లేదు)',
    liveBadge: 'లైవ్ మోడల్',
    sendLabel: 'అడగండి',
    cancelStreamLabel: 'ఆపండి',
    knowledgeCheckLabel: 'పాఠం పరీక్ష',
    adaptiveLabel: 'నైపుణ్యం & SM-2 చూడండి',
  },
  ar: {
    companionTitle: 'مساعد الذكاء الاصطناعي للدرس',
    askPlaceholder: 'اطرح سؤالاً حول هذا الدرس أو البراهين الرياضية...',
    aiNoticeBadge: 'إرشاد بالذكاء الاصطناعي — منفصل عن ملاحظات المقرر المعتمدة',
    fallbackBadge: 'دعم أكاديمي محلي (النموذج المباشر غير متاح)',
    liveBadge: 'نموذج مباشر',
    sendLabel: 'إرسال',
    cancelStreamLabel: 'إيقاف',
    knowledgeCheckLabel: 'اختبار فهم الدرس',
    adaptiveLabel: 'عرض الإتقان و SM-2',
  },
};

export function getAiLocaleConfig(languageCode?: string): {
  option: LanguageOption;
  strings: AiUiStrings;
} {
  const normalized = (languageCode || 'en').toLowerCase().split(/[-_]/)[0];
  const option =
    AI_SUPPORTED_LANGUAGES.find((l) => l.code === normalized) || AI_SUPPORTED_LANGUAGES[0];
  const strings = LOCALIZED_UI_STRINGS[option.code] || LOCALIZED_UI_STRINGS.en;
  return { option, strings };
}
