# AQUI NET HUB — Android release

## Architecture

The Android application uses Capacitor 8 and the existing React/Vite application. The same product code powers the website, installable PWA and Android package. Authentication, database access and privileged operations remain on the existing Supabase/Cloudflare backend.

## Automated build

The GitHub Actions workflow `.github/workflows/android-build.yml` builds the web bundle, generates the native Android project, runs Gradle and stores the APK and AAB as workflow artifacts. It runs on relevant pushes and can also be started manually from GitHub Actions.

The debug APK is intended for device testing. The release AAB generated without an upload keystore is unsigned and is not ready for Play Console submission.

## Signing and store publication

A production Play Store release requires a persistent upload key, a verified Play Console developer account, store listing assets, policy declarations, a privacy policy and completion of Google's testing/review requirements. Never commit a keystore or passwords to Git.

Once a protected upload keystore and Play Console publishing credentials are configured as GitHub Actions secrets, a separate protected release workflow can sign and upload a reviewed release. The owner must retain control of the signing key and Play Console account.

## Local Android development

Requirements: Node.js 22+, Android Studio and Android SDK.

```bash
npm install
npm run build
npm run android:add
npx cap sync android
npx cap open android
```

For future web changes:

```bash
npm run android:sync
```

## Offline behavior and data safety

The service worker caches only the static application shell and same-origin static assets. It deliberately bypasses API, authentication and database requests: account data, OAuth, social analytics, payments and advertisements require a live connection and are never stored in the offline cache.
