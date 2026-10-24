import type { SQLiteDatabase } from 'expo-sqlite';

import type { IconName } from '@/components/Icon';

import type { ToolDefinition } from '../types';

export type ToolInput = Record<string, unknown>;
/** Small JSON the model reads back. Failures are reported as { error } instead of thrown. */
export type ToolResult = Record<string, unknown>;

export interface ToolContext {
  db: SQLiteDatabase;
  /** The chat the request came from. */
  conversationId: number;
}

/** What to ask the user before a destructive tool runs. */
export interface ConfirmPrompt {
  title: string;
  message: string;
  action: string;
}

/**
 * A tool the AI can call. Handlers check their own input, since models
 * sometimes send wrong or missing fields, and throw an Error with a message
 * the model can act on.
 */
export interface Tool extends ToolDefinition {
  icon: IconName;
  /** One line for the card in the chat. `result` is undefined while the tool runs or if it failed. */
  label: (input: ToolInput, result?: ToolResult) => string;
  /** For destructive tools: what to ask first. Resolving null runs the tool without asking. */
  confirm?: (input: ToolInput, context: ToolContext) => Promise<ConfirmPrompt | null>;
  run: (input: ToolInput, context: ToolContext) => Promise<ToolResult>;
}

/** Reads a required (or optional) string field, trimmed. */
export function stringInput(input: ToolInput, key: string, { required = true, max = 500 } = {}): string {
  const value = input[key];
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    if (required) throw new Error(`"${key}" is required.`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`"${key}" must be a string.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`"${key}" must be at most ${max} characters.`);
  return text;
}

/** Reads an optional whole number field. Numbers sent as strings are accepted. */
export function integerInput(input: ToolInput, key: string, { min = -Infinity, max = Infinity } = {}): number | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) throw new Error(`"${key}" must be a whole number.`);
  if (number < min || number > max) throw new Error(`"${key}" must be between ${min} and ${max}.`);
  return number;
}

/** A field as display text for card labels, which must never throw. */
export function shown(value: unknown, max = 80): string {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A local date and time as "2026-10-24 18:00", the form the model is given and sends back. */
export function localDateTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A time for people, such as "Sat, 24 Oct, 6:00 pm". */
export function friendlyTime(ms: number) {
  return new Date(ms).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
