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

**No signed release path is currently implemented.** Document Android signing separately if needed.

## iOS App Store Release

This section covers the signed iOS release path for App Store submission and public distribution.

### Prerequisites

1. **Apple Developer Account**
   - Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
   - Create an App ID matching bundle identifier: `com.simgames.simsoviet1917`
   - Create App Store Connect account and app record

2. **Certificates and Provisioning**
   - Generate an **iOS Distribution Certificate** in Xcode or Apple Developer portal
   - Create an **App Store Provisioning Profile** linked to the app ID and certificate
   - Export the certificate + private key as `.p12` file and encode to base64 for GitHub

3. **Required Secrets** (configure in GitHub repo settings)
   - `EXPO_APPLE_ID`: Apple ID email used for signing
   - `EXPO_TEAM_ID`: Apple Team ID (10-character alphanumeric, found in Membership Details)
   - `APPLE_APP_SPECIFIC_PASSWORD`: Generated in [Apple ID account settings](https://appleid.apple.com/account/manage) under Security → App-Specific Passwords
   - `APPLE_DISTRIBUTION_CERT_BASE64`: Base64-encoded `.p12` distribution certificate
   - `APPLE_DISTRIBUTION_CERT_PASSWORD`: Password protecting the `.p12` file

### EAS Build Configuration

For signed iOS builds, create or update `eas.json` at project root:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "production": {
      "ios": {
        "image": "macos-13",
        "channel": "production",
        "resourceClass": "large",
        "credentials": {
          "teamId": "$EXPO_TEAM_ID",
          "distributionCertificate": "$APPLE_DISTRIBUTION_CERT_BASE64",
          "distributionCertificatePassword": "$APPLE_DISTRIBUTION_CERT_PASSWORD",
          "provisioningProfileId": "$EXPO_PROVISIONING_PROFILE_ID"
        },
        "buildType": "app-store"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "$EXPO_APPLE_ID",
        "appleSpecificPassword": "$APPLE_APP_SPECIFIC_PASSWORD"
      }
    }
  }
}
```

**Do not commit `eas.json` if it contains inline credential values.** Use GitHub secrets references or environment variable substitution in the workflow.

### Integration with GitHub Workflows

To add signed iOS builds to `release.yml`:

1. After `release-please` creates a tag, add a new job (`ios-app-store`):

```yaml
ios-app-store:
  needs: release-please
  if: needs.release-please.outputs.release_created == 'true'
  runs-on: macos-14
  environment: production  # optional: enforce approval
  env:
    TARGET_REF: ${{ needs.release-please.outputs.tag_name }}
    EXPO_APPLE_ID: ${{ secrets.EXPO_APPLE_ID }}
    EXPO_TEAM_ID: ${{ secrets.EXPO_TEAM_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      with:
        ref: ${{ env.TARGET_REF }}
        lfs: true

    - uses: pnpm/action-setup@078e9d416474b29c0c387560859308974f7e9c53 # v6.0.1
      with:
        version: 10.33.0

    - uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f # v6.3.0
      with:
        node-version: 22
        cache: pnpm

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build web assets
      run: pnpm run build

    - name: EAS build
      uses: expo/expo-github-action@d426ed6f1ee52a3a84e49de1f39c9f06e06c23f5 # v8.1.0
      with:
        eas-version: latest
        token: ${{ secrets.EXPO_TOKEN }}

    - name: Build and submit iOS (App Store)
      run: |
        eas build \
          --platform ios \
          --profile production \
          --auto-submit \
          --wait \
          --verbose
```

2. **`EXPO_TOKEN`**: Generate in [Expo.dev dashboard](https://expo.dev/accounts/[username]/settings/access-tokens)

### Manual Submission (if not using auto-submit)

1. Build locally or via EAS without auto-submit:
   ```bash
   eas build --platform ios --profile production --wait
   ```

2. Submit via Xcode Organizer or Transporter:
   ```bash
   xcrun altool --upload-app --file build.ipa --username $EXPO_APPLE_ID
   ```

3. Monitor submission status in [App Store Connect](https://appstoreconnect.apple.com/)

### Troubleshooting

- **"Provisioning profile not found"**: Verify profile is active and matches bundle ID in Xcode
- **"Certificate revoked"**: Regenerate distribution certificate in Apple Developer portal
- **"Invalid certificate format"**: Re-export `.p12` and base64-encode with `cat cert.p12 | base64 | pbcopy`
- **"Authentication failed"**: Verify app-specific password is correct (not regular Apple ID password)

### Post-Release

After successful App Store submission:

1. Review metadata and assets in App Store Connect
2. Submit for review (automatic or manual)
3. Monitor review status (typically 24–48 hours)
4. Release to Production or phased rollout
5. Verify app is accessible in App Store within 30 minutes of release

See [RELEASE.md](./RELEASE.md) for the full workflow chain (ci → release → cd).
