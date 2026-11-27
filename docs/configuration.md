# Configuration

Nova has **no environment variables and no `.env` file**. API keys are entered in the app and kept in secure storage, never in the repository.

## Contents

- [AI providers](#ai-providers)
- [In-app settings](#in-app-settings)
- [app.json](#appjson)
- [eas.json](#easjson)

## AI providers

Add a provider in the app under **Settings → Add provider**: pick a service, paste its API key and choose a model. You can save several providers and switch between them.

| Preset | Format | Base URL | Key |
| --- | --- | --- | --- |
| OpenAI | OpenAI | `https://api.openai.com/v1` | Required |
| Anthropic | Anthropic | `https://api.anthropic.com/v1` | Required |
| Google Gemini | OpenAI-compatible | `https://generativelanguage.googleapis.com/v1beta/openai` | Required |
| OpenRouter | OpenAI-compatible | `https://openrouter.ai/api/v1` | Required |
| Groq | OpenAI-compatible | `https://api.groq.com/openai/v1` | Required |
| DeepSeek | OpenAI-compatible | `https://api.deepseek.com/v1` | Required |
| Ollama / LM Studio | OpenAI-compatible | Your computer's address, e.g. `http://192.168.1.10:11434/v1` | Optional |
| Custom | OpenAI-compatible or Anthropic | Any URL, usually ending in `/v1` | Optional |

The presets are defined in `src/ai/presets.ts`.

- **API keys** are stored with `expo-secure-store` (backed by the Android Keystore) under `nova.provider.<id>.apiKey`, and are sent only to their own provider. Paste only the key itself. A key containing spaces or quotes (for example `openrouter: sk-…`) is rejected.
- **Ollama or LM Studio**: use the computer's network address, not `localhost`. The phone and the computer must be on the same Wi-Fi. Plain `http://` works because `app.json` allows cleartext traffic.
- **Models** come from the provider's `/models` list, or you can type a name.

## In-app settings

These live in the `settings` table of the app's database, not in files.

| Setting | Where to change it | Notes |
| --- | --- | --- |
| Active provider and model | Chat header, or Settings | The last 5 picks appear under **Recent** |
| Custom instructions | Settings → Personalisation | "About you" and "How Nova should reply", up to 1,000 characters each, sent with every message |
| Memory | Settings → Memory | Facts the AI saved; up to 50 |
| Exact reminder times | Settings → Reminders (Android) | Opens Android's "Alarms & reminders" permission screen |

## app.json

| Setting | Value | Purpose |
| --- | --- | --- |
| `android.package` | `com.hz.nova` | Application ID |
| `android.permissions` | `SCHEDULE_EXACT_ALARM` | Lets reminders fire at the exact minute |
| `plugins` | `expo-router`, `expo-splash-screen`, `expo-sqlite`, `expo-secure-store`, `expo-notifications`, `expo-build-properties` | `expo-build-properties` sets `usesCleartextTraffic` for local AI servers |
| `experiments` | `typedRoutes`, `reactCompiler` | Typed Expo Router routes, React Compiler |

`expo-local-authentication` needs no config plugin on Android. Its permissions come from the library's own manifest.

The `android/` and `ios/` folders are generated from `app.json` and aren't checked in. Configure native behaviour here or in config plugins, never by editing those folders.

## eas.json

All profiles extend `base`, which pins Node 24.20.0. App versions are managed remotely by EAS (`appVersionSource: remote`).

| Profile | Output | Use |
| --- | --- | --- |
| `development` | APK with dev client, internal distribution | Daily development |
| `preview` | APK, internal distribution | Testing a standalone build |
| `production` | APK, build number bumped automatically | Releases |

See [deployment.md](deployment.md) for building and releasing.
