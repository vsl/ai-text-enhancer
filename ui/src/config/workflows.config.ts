import { AVAILABLE_MODELS } from './catalog.config';
import type { AiConfig, Options, Workflow } from '@/lib/types';

export const DEFAULT_OPTIONS: Options = {
  improve: true,
  fixMistakes: true,
  format: false,
  shorten: false,
  lengthen: false,
  addEmojis: false,
  avoidCommonAiSymbols: true,
  formality: 'Neutral',
  tone: 'Confident',
  languageLevel: '',
  translateTo: '',
};

/** Defaults for newly created assistants and storage normalization. */
export const DEFAULT_ASSISTANT: Omit<AiConfig, 'id'> = {
  model: AVAILABLE_MODELS[0],
  aiRoleId: 'editor',
  options: DEFAULT_OPTIONS,
  enabled: true,
};

export const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    name: 'Quick Fix',
    configs: [
      {
        id: 1,
        model: 'qwen-qwen3-30b-a3b-instruct-2507',
        aiRoleId: 'editor',
        options: { ...DEFAULT_OPTIONS },
        enabled: true,
      },
      {
        id: 2,
        model: 'openai-gpt-5-nano',
        aiRoleId: 'editor',
        options: { ...DEFAULT_OPTIONS, improve: false, tone: 'Direct' },
        enabled: true,
      },
      {
        id: 3,
        model: 'open-router-free',
        aiRoleId: 'editor',
        options: { ...DEFAULT_OPTIONS, format: true, shorten: true },
        enabled: true,
      },
    ],
  },
  {
    name: 'Formal Email',
    configs: [
      {
        id: 1,
        model: 'qwen-qwen3-30b-a3b-instruct-2507',
        aiRoleId: 'email_assistant',
        options: { ...DEFAULT_OPTIONS, format: true, formality: 'Formal', tone: 'Polite' },
        enabled: true,
      },
      {
        id: 2,
        model: 'openai-gpt-5-nano',
        aiRoleId: 'email_assistant',
        options: { ...DEFAULT_OPTIONS, format: true, shorten: true, formality: 'Formal', tone: 'Direct' },
        enabled: true,
      },
      {
        id: 3,
        model: 'open-router-free',
        aiRoleId: 'email_assistant',
        options: { ...DEFAULT_OPTIONS, format: true, formality: 'Formal', tone: 'Empathetic' },
        enabled: true,
      },
    ],
  },
];

export const DEFAULT_WORKFLOW_NAMES = DEFAULT_WORKFLOWS.map(w => w.name);
