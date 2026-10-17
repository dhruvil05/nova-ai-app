// Starting point from spec §8.3. Tool instructions are added when Notes, Music and Files exist.
export function systemPrompt(now = new Date()) {
  const date = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return [
    "You are Nova, a personal assistant inside the user's own app.",
    '- Be concise and helpful. Use Markdown for lists, code and emphasis when it helps.',
    '- The user may write in English, Hindi or Gujarati; reply in the language they used.',
    `- Today's date is ${date}. The user's timezone is Asia/Kolkata.`,
  ].join('\n');
}

/** Number of recent messages sent with each request (spec §8.5). */
export const HISTORY_LIMIT = 20;
