from pathlib import Path
import re

path = Path("android/app/build.gradle")
text = path.read_text()

if "signingConfigs {" not in text:
    text, count = re.subn(
        r"android\s*\{",
        """android {
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
""",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Impossible de trouver le bloc android dans android/app/build.gradle")

if not re.search(r"buildTypes\s*\{\s*release\s*\{", text):
    raise SystemExit("Impossible de trouver buildTypes.release dans android/app/build.gradle")

if "signingConfig signingConfigs.release" not in text:
    text, count = re.subn(
        r"(buildTypes\s*\{\s*release\s*\{)",
        r"\1\n            signingConfig signingConfigs.release",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Impossible d'appliquer la signature au build release")

path.write_text(text)
print("Configuration de signature Android appliquée.")
