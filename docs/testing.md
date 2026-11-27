# Testing

## Automated tests

Nova uses **Jest** with Expo's `jest-expo` preset, configured in `package.json` (`testEnvironment: node`, with `@/` mapped to `src/`).

```bash
npm test
```

Tests live in `test/`:

| File | What it covers |
| --- | --- |
| `notesPrivacy.test.ts` | The AI's note tools against the real migrations and SQL. Private notes are never found, read, changed or deleted by the AI, even when every word matches, and a private id gets the same error as a missing one. Also covers creating (marked as AI-written), word-start search, appending, and a declined delete. |
| `sqlite.ts` | Test adapter, not a test. Gives the repositories the `expo-sqlite` methods they use (`execAsync`, `getAllAsync`, `getFirstAsync`, `runAsync`), backed by Node's built-in `node:sqlite`. |

Node's SQLite has FTS5, like Android's, so the full-text search path is what gets tested. Each test gets a fresh in-memory database.

**Writing tests:**
- Import `test`, `expect` and friends from `@jest/globals`. TypeScript 6 doesn't load global type packages by default.
- Put new test files in `test/` with the `.test.ts` suffix.

## Static checks

```bash
npx tsc --noEmit
npx expo lint
```

The typecheck includes the test files.

## Manual testing

These need a phone with a current development build:

- **Reminders**: notification permission, delivery, and exact timing.
- **Private notes**: the fingerprint, face or screen-lock prompt, and locking when Nova goes to the background.
- **Provider connections** with real API keys.

The [web preview](development.md#web-preview) covers most screens and the chat flow. Its differences from the phone are listed in [architecture.md](architecture.md#platform-differences).
