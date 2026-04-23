---
title: Deployment and Release
updated: 2026-04-23
status: current
domain: ops
---

# Deployment and Release

This document covers deployment targets and procedures for SimSoviet 1917.

## Web Deployment

The web build is deployed to GitHub Pages at [arcade-cabinet.github.io/sim-soviet](https://arcade-cabinet.github.io/sim-soviet/) via the `cd.yml` workflow on every `main` push.

- **Build**: `pnpm run build` produces static assets in `dist/`
- **Deployment**: Automatic via GitHub Pages + CD workflow
- **Asset URL prefix**: `/sim-soviet/` (configured in build)

## Android Debug APK

Debug APK builds are triggered on release tags via `release.yml`:

1. `release-please` creates a tag on `main`
2. CI runs Android prebuild and Gradle assemble
3. APK is uploaded as a GitHub Release asset

---

## Android Signed Release

### Overview

A signed release APK is required for Google Play Store distribution. This section documents the required secrets, keystore generation, and Gradle configuration.

### Required GitHub Secrets

Before enabling signed APK builds, set these repository secrets in GitHub:

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore file | See "Generating a Keystore" below |
| `KEYSTORE_PASSWORD` | Password protecting the keystore | Chosen during keystore generation |
| `KEY_ALIAS` | Alias of the key within the keystore | Chosen during keystore generation |
| `KEY_PASSWORD` | Password for the specific key | Chosen during keystore generation (can match keystore password) |

### Generating a Keystore

Run this command on a secure local machine:

```bash
keytool -genkey -v \
  -keystore sim-soviet-release.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias sim-soviet-release \
  -storepass <KEYSTORE_PASSWORD> \
  -keypass <KEY_PASSWORD>
```

Replace `<KEYSTORE_PASSWORD>` and `<KEY_PASSWORD>` with secure passphrases. The tool will prompt for additional identity fields (name, organization, country, etc.).

After generation, encode the keystore as Base64:

```bash
base64 -i sim-soviet-release.keystore > keystore.b64
```

Store `keystore.b64` contents in the `ANDROID_KEYSTORE_BASE64` GitHub secret. **Never commit the raw `.keystore` file.**

### Gradle Signing Configuration

Add to `android/app/build.gradle.kts` (or `build.gradle` if using Groovy):

```kotlin
android {
    // ... existing configuration ...

    signingConfigs {
        create("release") {
            // NOTE: In CI, these are populated from GitHub secrets (see release.yml).
            // Locally, you may use relative paths to your development keystore.
            storeFile = file(System.getenv("KEYSTORE_FILE") ?: "sim-soviet-release.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            minifyEnabled = true
            shrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### Release Workflow Integration

In `.github/workflows/release.yml`, the `android-apk` job will be extended to sign the release APK. The job will:

1. Decode `ANDROID_KEYSTORE_BASE64` to a temporary keystore file.
2. Set environment variables for keystore credentials.
3. Run `./gradlew assembleRelease` instead of `assembleDebug`.
4. Upload the signed APK to the GitHub Release.

**Annotation only** (no secrets are committed):

```yaml
android-apk:
  needs: release-please
  if: needs.release-please.outputs.release_created == 'true'
  runs-on: ubuntu-latest
  env:
    TARGET_REF: ${{ needs.release-please.outputs.tag_name }}
  steps:
    # ... existing checkout, Java, Android setup, Node setup, pnpm install, build steps ...

    - name: Decode keystore  # NEW: Decode keystore from GitHub secret
      run: |
        echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/sim-soviet-release.keystore

    - name: Build release APK  # MODIFIED: Use assembleRelease instead of assembleDebug
      env:
        KEYSTORE_FILE: android/app/sim-soviet-release.keystore
        KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
        KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
        KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
      working-directory: android
      run: ./gradlew assembleRelease

    - name: Upload APK to release
      env:
        GH_TOKEN: ${{ secrets.CI_GITHUB_TOKEN }}
        TAG: ${{ needs.release-please.outputs.tag_name }}
      run: |
        set -euo pipefail
        apk="$(find android/app/build/outputs/apk -name '*.apk' | head -1)"
        test -f "$apk"
        gh release upload "$TAG" "$apk" --clobber
```

### Local Development

For local testing without committing the keystore:

1. Generate a debug/development keystore (see "Generating a Keystore" above).
2. Place it in `android/app/sim-soviet-release.keystore` (excluded by `.gitignore`).
3. Set environment variables locally:

```bash
export KEYSTORE_FILE=android/app/sim-soviet-release.keystore
export KEYSTORE_PASSWORD=<your-debug-password>
export KEY_ALIAS=<your-debug-alias>
export KEY_PASSWORD=<your-debug-password>
```

4. Build the release APK:

```bash
cd android && ./gradlew assembleRelease
```

The APK will appear in `android/app/build/outputs/apk/release/`.

### Verification

After a release is built (locally or in CI), verify the signature:

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/app-release.apk
```

Or use Android CLI tools:

```bash
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

### Troubleshooting

- **"Signature does not verify"**: Ensure the keystore password, key alias, and key password match exactly. Regenerate if needed.
- **Build fails with signing error**: Verify the keystore file exists and the environment variables are set before running `assembleRelease`.
- **GitHub secret not decoding**: Ensure the Base64-encoded keystore was generated with `base64 -i` (input from file), not manual encoding.

---

See [RELEASE.md](./RELEASE.md) for the full workflow chain (ci → release → cd).
