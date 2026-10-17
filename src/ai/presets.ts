import type { ProviderKind } from './llm';

/** Known services that pre-fill the provider form. "Custom" covers anything else. */
export interface ProviderPreset {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  needsKey: boolean;
  /** Short help shown under the form. */
  hint?: string;
}

export const PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    hint: 'Create a key at platform.openai.com/api-keys.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    hint: 'Create a key at console.anthropic.com.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    needsKey: true,
    hint: 'Create a key at aistudio.google.com/apikey.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    hint: 'One key for hundreds of models. Create one at openrouter.ai/keys.',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    hint: 'Very fast replies. Create a key at console.groq.com/keys.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    needsKey: true,
    hint: 'Create a key at platform.deepseek.com.',
  },
  {
    id: 'local',
    label: 'Ollama / LM Studio',
    kind: 'openai',
    baseUrl: '',
    needsKey: false,
    hint:
      "Use your computer's network address, not localhost, for example http://192.168.1.10:11434/v1 for Ollama or http://192.168.1.10:1234/v1 for LM Studio. The phone and computer must be on the same Wi-Fi.",
  },
  {
    id: 'custom',
    label: 'Custom',
    kind: 'openai',
    baseUrl: '',
    needsKey: false,
    hint: 'Any service with an OpenAI-compatible API. The base URL usually ends in /v1.',
  },
];

export function presetById(id: string): ProviderPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
}
