# AQUI NET HUB — Android release

## Architecture

The Android application uses Capacitor 8 and the existing React/Vite application. The same product code powers the website, installable PWA and Android package. The native WebView loads the bundled client from `dist/client`.

The native shell routes same-origin `/api/*` calls to the production Cloudflare Worker and enables Capacitor's native HTTP transport. Supabase client traffic and external requests remain unchanged. API calls, authentication and payment requests are not placed in the offline cache.

## Native authentication and payments

TikTok and Facebook OAuth are opened in the system browser. The Worker stores a random, one-time state and marks native sessions with a native suffix. After provider approval, the Worker redirects to the registered `aquinet://oauth` deep link. The Android intent filter and Capacitor App listener return the user to the bundled app without discarding its local Supabase session.

CinetPay returns through a Worker HTTPS endpoint, which then redirects to the same app deep link. Payment status remains verified by the server-side webhook; the browser return alone does not mark an order as paid.

## Automated build

The GitHub Actions workflow `.github/workflows/android-build.yml` builds the web bundle, generates the native Android project, configures deep links and branded launcher icons, runs Gradle and stores the APK and AAB as workflow artifacts.

The debug APK is intended for device testing. The release AAB generated without an upload keystore is unsigned and is not ready for Play Console submission.

## Signing and store publication

A production Play Store release requires a persistent upload key, a verified Play Console developer account, store listing assets, policy declarations, a privacy policy and completion of Google's testing/review requirements. Never commit a keystore or passwords to Git.

Once a protected upload keystore and Play Console publishing credentials are configured as GitHub Actions secrets, a protected release workflow can sign and upload a reviewed release. The owner must retain control of the signing key and Play Console account.

## Local Android development

Requirements: Node.js 22+, Android Studio and Android SDK.

```bash
npm install
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

## Offline behavior and data safety

The service worker caches only the static application shell, icons and same-origin static assets. It deliberately bypasses API, authentication and database requests. The Android bundle itself contains the application shell, so it can open without a network connection after installation; live account data, social analytics, AI generation and payments still require connectivity.
