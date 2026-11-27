# Development

Working on Nova's code. For setup, see [installation.md](installation.md); for how the parts fit together, see [architecture.md](architecture.md).

## Contents

- [Commands](#commands)
- [Project structure](#project-structure)
- [Conventions](#conventions)
- [Adding a tool](#adding-a-tool)
- [Web preview](#web-preview)

## Commands

| Command | What it does |
| --- | --- |
| `npx expo start` | Start the dev server (`npm start`) |
| `npx expo start --web` | Start the [web preview](#web-preview) (`npm run web`) |
| `npx expo lint` | Lint (`npm run lint`) |
| `npx tsc --noEmit` | Typecheck |
| `npm test` | Unit tests; see [testing.md](testing.md) |
| `npx expo-doctor` | Check dependencies and config |
| `npx expo install <package>` | Add a package at the SDK-compatible version |
| `npx expo install --fix` | Fix incompatible package versions |

Run lint, the typecheck and the tests before calling a change done.

## Project structure

```
src/
├── app/                    # Screens; every file is a route (Expo Router)
│   ├── _layout.tsx         # Root: theme, SQLite, providers, confirm dialog, lock on background
│   ├── (tabs)/             # Bottom tabs: index.tsx (AI chat), notes.tsx (Notes)
│   ├── note/[id].tsx       # Note editor with autosave
│   ├── conversations.tsx   # Past chats and search
│   ├── settings.tsx        # Providers, model, instructions, memory, reminders, data
│   ├── instructions.tsx    # Custom instructions
│   ├── provider/[id].tsx   # Add or edit an AI provider
│   └── models.tsx          # Switch provider and model
├── ai/
│   ├── llm.ts              # chat() and listModels()
│   ├── providers/          # OpenAI-compatible and Anthropic adapters
│   ├── agent.ts            # Tool-calling loop
│   ├── tools/              # Tools, one file per group: notes, chats, memory, reminders
│   ├── prompt.ts           # System prompt
│   ├── title.ts            # Chat titles
│   ├── presets.ts          # Known services for the provider form
│   ├── sse.ts, think.ts    # Stream parsing, <think> tag splitting
│   └── types.ts            # Shared types
├── db/                     # migrate.ts and one repository per table
├── services/               # reminders (expo-notifications)
├── store/                  # Zustand: chat, providers, notes, privacy
├── components/             # Message bubbles, tool cards, note cards, composer, dialogs, Markdown
├── hooks/                  # useHover
├── lib/                    # Secure keys, confirm, unlock, navigation, formatting
└── theme.ts                # Colours, spacing, radii
test/                       # Jest tests and the SQLite test adapter
docs/                       # This documentation and screenshots
```

## Conventions

- **Expo SDK 58.** Expo changes between SDKs, so check the [versioned docs](https://docs.expo.dev/versions/v58.0.0/) before using an API, and add packages with `npx expo install`.
- **Expo Router** for navigation. Only routes go in `src/app/`; components, hooks and helpers live outside it.
- **Never edit `android/` or `ios/`.** They're generated. Configure native behaviour in `app.json` and config plugins.
- **Screens stay thin**: they call repositories and services, never raw SQL.
- **Migrations are append-only**: never edit one that has shipped.
- **Native modules load safely.** Code using a recently added native module checks for it with `requireOptionalNativeModule` and loads it lazily, so an older development build loses only that feature instead of failing to start (see `src/services/reminders.ts` and `src/lib/unlock.ts`).
- **TypeScript strict mode**, ESLint from `eslint-config-expo`, React Compiler on.
- **Commit after every working feature.** Release tags follow `vMAJOR.MINOR.PATCH`; see [deployment.md](deployment.md#releasing).

## Adding a tool

1. Add it to a file in `src/ai/tools/` (or a new file for a new group) as a `Tool`:
   - `name`, `description` and a JSON Schema `inputSchema`, which the model reads.
   - `icon` and `label(input, result)` for its card in the chat.
   - `run(input, context)`, which does the work and returns small JSON.
   - Optionally `confirm(input, context)`, for anything destructive.
2. Register it in `TOOLS` in `src/ai/tools/index.ts`.
3. Read inputs with `stringInput` and `integerInput`. Models send wrong or missing fields, so throw an `Error` with a message the model can act on.
4. Call repositories and services, never raw SQL, so the AI and the screens behave the same. Note tools must pass `includePrivate: false`.
5. Return what the model needs, not whole records. Cut long text and say it was cut.

In development, every tool call and its result is logged to the console.

## Web preview

`npx expo start --web` is useful for quick UI checks, but it isn't the real app. Its differences are listed in [architecture.md](architecture.md#platform-differences). The main ones:
- API keys are kept in `localStorage`.
- Reminders are unavailable.
- Fingerprint unlock is replaced by a dialog.
- Note search uses plain matching.
