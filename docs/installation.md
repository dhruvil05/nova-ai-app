# Installation

How to get Nova running for development. For building release APKs, see [deployment.md](deployment.md).

## Prerequisites

| Requirement | Version | Why |
| --- | --- | --- |
| Node.js | 24.20 | The version EAS builds with (`build.base.node` in `eas.json`) |
| npm | 11.19 | Matches EAS. An older npm can write a `package-lock.json` that EAS's `npm ci` rejects; see [troubleshooting](troubleshooting.md#eas-build-fails-at-install-dependencies) |
| Android phone | Android with a screen lock recommended | Nova is Android-first; private notes use the screen lock |
| Expo account | — | For EAS cloud builds |
| AI service | — | An API key for at least one service, or Ollama / LM Studio on your computer |

Android Studio and the Android SDK are optional. They're only needed to build locally with `npx expo run:android`.

## Install dependencies

```bash
git clone https://github.com/dhruvil05/nova-ai-app.git
cd nova-ai-app
npm install
```

## Install a development build on your phone

Nova uses native modules that Expo Go doesn't include (`expo-notifications`, `expo-local-authentication`, `expo-dev-client`), so it runs in its own development build. Build it in the cloud and install the APK from the link EAS prints:

```bash
npx eas-cli@latest build --profile development --platform android
```

With the Android SDK installed, you can build and install locally instead:

```bash
npx expo run:android
```

Make a new development build whenever a package with native code is added, or plugins or permissions change in `app.json`. Until then the old build keeps working, but features that need the new native code are unavailable.

## Start the app

```bash
npx expo start
```

Open Nova's development build on the phone and scan the QR code.

## Database

There's nothing to set up. Nova creates its SQLite database, `nova.db`, on first launch and applies migrations automatically. See [architecture.md](architecture.md#data) for the schema.

## Next steps

- [Connect an AI service](configuration.md#ai-providers)
- [Use the app](usage.md)
- [Development workflow](development.md)
