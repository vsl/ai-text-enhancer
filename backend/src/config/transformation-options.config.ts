export const BOOLEAN_TRANSFORMATION_KEYS = [
  'improve',
  'fixMistakes',
  'format',
  'shorten',
  'lengthen',
  'addEmojis',
  'avoidCommonAiSymbols',
] as const;

export const FORMALITY_VALUES = ['Casual', 'Neutral', 'Formal'] as const;

export const TONE_VALUES = [
  'Confident',
  'Empathetic',
  'Cheerful',
  'Witty',
  'Direct',
  'Engaging',
  'Polite',
  'Sincere',
  'Disappointed',
  'Apologetic',
  'Pessimistic',
  'Worried',
] as const;

export const LANGUAGE_LEVEL_VALUES = [
  'default',
  'simple',
  'intermediate',
  'advanced',
  'fluent',
  'native',
] as const;

export const LANGUAGE_VALUES = [
  'ar',
  'zh',
  'en',
  'fr',
  'de',
  'hi',
  'it',
  'ja',
  'ko',
  'pt',
  'ru',
  'es',
  'uk',
  'vi',
] as const;

export const TRANSFORMATION_OPTION_KEYS = [
  ...BOOLEAN_TRANSFORMATION_KEYS,
  'formality',
  'tone',
  'languageLevel',
  'translateTo',
] as const;

export type Formality = typeof FORMALITY_VALUES[number];
export type Tone = typeof TONE_VALUES[number];
export type LanguageLevel = typeof LANGUAGE_LEVEL_VALUES[number];
export type Language = typeof LANGUAGE_VALUES[number];

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
  Confident: 'Use a confident, assured tone with decisive wording and no unnecessary uncertainty.',
  Empathetic: 'Use an empathetic, considerate tone that acknowledges the reader\'s feelings or perspective without sounding patronizing.',
  Cheerful: 'Use a cheerful, upbeat tone that feels energetic without exaggeration.',
  Witty: 'Use a witty tone with light, relevant humor that does not obscure the message.',
  Direct: 'Use a direct tone that leads with the main point and avoids hedging, filler, and vague language.',
  Engaging: 'Use an engaging, reader-oriented tone with active language and varied rhythm.',
  Polite: 'Use a polite, courteous tone with respectful wording and considerate requests.',
  Sincere: 'Use a sincere, genuine tone with plain language and no canned enthusiasm.',
  Disappointed: 'Express restrained dissatisfaction by focusing on the unmet expectation and its impact.',
  Apologetic: 'Use an apologetic tone that clearly takes ownership, acknowledges impact, and avoids excuses.',
  Pessimistic: 'Use a pessimistic, risk-focused tone that emphasizes limitations and downsides without inventing risks.',
  Worried: 'Use a worried, concerned tone that communicates uncertainty or urgency without becoming alarmist.',
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  ar: 'Arabic',
  zh: 'Chinese',
  en: 'English',
  fr: 'French',
  de: 'German',
  hi: 'Hindi',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  ru: 'Russian',
  es: 'Spanish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
};
