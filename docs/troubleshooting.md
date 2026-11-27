# Troubleshooting

## Contents

- [EAS build fails at "Install dependencies"](#eas-build-fails-at-install-dependencies)
- [Cannot find native module](#cannot-find-native-module)
- [Request failed (401)](#request-failed-401)
- [Can't reach Ollama or LM Studio](#cant-reach-ollama-or-lm-studio)
- [Reminders arrive late](#reminders-arrive-late)
- [Model replies without using tools](#model-replies-without-using-tools)
- [Known limitations](#known-limitations)

## EAS build fails at "Install dependencies"

The build log shows `npm ci` refusing to install because `package.json` and `package-lock.json` aren't in sync, often listing packages as "Missing … from lock file".

**Cause:** the lockfile was written by an older npm than the one EAS uses. Newer npm records peer dependencies of optional packages that older versions leave out.

**Fix:** use the npm version EAS uses (11.19, which comes with the Node 24.20 pinned in `eas.json`), then regenerate the lockfile:

```bash
npm install -g npm@11.19.0
npm install
```

## Cannot find native module

For example `Cannot find native module 'ExpoPushTokenManager'`, or Nova saying a feature "needs a newer build".

**Cause:** the development build on the phone predates a package with native code. JavaScript updates arrive through `npx expo start`, but native code only arrives with a new build.

**Fix:** make and install a new development build ([installation.md](installation.md#install-a-development-build-on-your-phone)). Until then:
- Reminders are unavailable.
- Private notes stay locked: they fail closed, not open.

## Request failed (401)

The provider rejected the API key.
- Check the key in **Settings → Edit provider**: paste only the key itself, with no label in front.
- "API key expired": create a new key at the provider.

## Can't reach Ollama or LM Studio

- Use the computer's network address (e.g. `http://192.168.1.10:11434/v1`), not `localhost`; on the phone, `localhost` is the phone itself.
- The phone and the computer must be on the same Wi-Fi.
- The server must listen on the network, not only on localhost.

## Reminders arrive late

Android delays reminders without the "Alarms & reminders" permission. Turn on **Settings → Reminders → Exact reminder times**.

## Model replies without using tools

Replies show "no tool support" under them: the model rejected tool calls, so Nova answered without tools for the rest of the session. Choose a model that supports tool calling for actions like notes and reminders.

## Known limitations

- **Android only for now.** iOS doesn't let third-party apps listen for their own wake word, which a later phase needs.
- **Recent-apps snapshot.** Android's recent-apps screen may show a snapshot of a private note that was open when you left Nova.
- **No screen lock, no protection.** On a phone without one, private notes open without a prompt.
- **Regenerate and edit re-run actions** in the replaced reply; regenerating a reply that set a reminder sets it again.
- **Web preview** isn't the real app; see [architecture.md](architecture.md#platform-differences).
