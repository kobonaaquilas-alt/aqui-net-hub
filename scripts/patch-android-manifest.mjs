import { readFileSync, writeFileSync } from 'node:fs'

const manifestPath = 'android/app/src/main/AndroidManifest.xml'
let manifest = readFileSync(manifestPath, 'utf8')

if (!manifest.includes('android:scheme="aquinet"')) {
  const activityClose = manifest.indexOf('</activity>')
  if (activityClose < 0) {
    throw new Error('MainActivity closing tag was not found in AndroidManifest.xml')
  }

  const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="aquinet" android:host="oauth" />
            </intent-filter>
`

  manifest = manifest.slice(0, activityClose) + intentFilter + manifest.slice(activityClose)
  writeFileSync(manifestPath, manifest)
}

const gradlePath = 'android/app/build.gradle'
let gradle = readFileSync(gradlePath, 'utf8')
gradle = gradle.replace(/versionCode\s*=?\s*\d+/, 'versionCode 2')
gradle = gradle.replace(/versionName\s*=?\s*['"][^'"]+['"]/, 'versionName "1.0.1"')
writeFileSync(gradlePath, gradle)
