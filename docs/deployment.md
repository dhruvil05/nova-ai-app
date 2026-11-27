# Deployment

Nova is distributed as an APK installed directly on the phone. There's no Play Store listing and no server to deploy.

## Building an APK

Builds run in the cloud with EAS. Profiles are described in [configuration.md](configuration.md#easjson).

```bash
npx eas-cli@latest build --profile production --platform android
```

Download the APK from the build page, copy it to the phone and install it (allow "Install unknown apps"). Installing over an existing version keeps your chats, notes and settings; migrations upgrade the database on first launch.

## Signing

Android installs an update only if it's signed with the same key as the installed app, or you'd have to uninstall it and lose its data. EAS creates and keeps the signing key. Download a backup with:

```bash
npx eas-cli@latest credentials
```

## Releasing

1. Set `"version"` in `app.json` (the version shown on the phone). EAS raises the build number itself.
2. Run the checks: `npx tsc --noEmit`, `npx expo lint`, `npm test`.
3. Commit, then tag and push:
   ```bash
   git tag -a vX.Y.Z -m "Nova vX.Y.Z"
   git push origin master vX.Y.Z
   ```
4. Build the production APK (above).
5. Create a release for the tag on the [GitHub Releases page](https://github.com/dhruvil05/nova-ai-app/releases/new), add release notes, attach the APK and publish.

If the repository is public, anyone can download the attached APK.

## When a new build is needed

JavaScript-only changes reach a development build through `npx expo start`. These need a new build:
- A package with native code was added.
- `app.json` plugins or permissions changed.

See [troubleshooting.md](troubleshooting.md#cannot-find-native-module) for what happens on an older build.
