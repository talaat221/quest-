# Quest Android

Quest uses Capacitor to package the existing React + Vite app as a native Android application.

## App identity

- App name: Quest
- Temporary Android package ID: `me.myquests.quest`
- Web bundle: `dist`

The package ID can still be changed before the first Google Play release. Once an app is published under a package ID, treat that ID as permanent.

## Local Android setup

Install:

1. Node.js 22+
2. Android Studio 2025.2.1 or newer
3. Android SDK / API 36

Then run:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

After future web changes:

```bash
npm run build
npm run cap:android
```

Then run the app from Android Studio on an emulator or a connected Android phone.

## Current phase

This first Android pass intentionally keeps the existing Quest web UI and Supabase backend. Native-specific work such as push notifications, app links for auth/reset-password flows, status bar treatment, icons/splash screens, Android back-button behavior, and Play Store signing should be added and tested in later passes before release.

## Cloud debug APK

The GitHub Actions workflow `Android Debug APK` builds an installable debug APK from this branch. It does not publish to Google Play and does not affect production.
