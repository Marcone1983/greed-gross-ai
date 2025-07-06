# GitHub Actions Setup Guide

## Required Secrets

To enable automated builds and deployments, configure these secrets in your GitHub repository settings:

### Android Build Secrets

1. **KEYSTORE_BASE64**
   - Your release keystore encoded in base64
   - Generate: `base64 -w 0 greed-gross-release-key.keystore`
   - Copy the output and paste as secret value

2. **KEYSTORE_PASSWORD**
   - The password for your keystore
   - Example: `your-keystore-password`

3. **KEY_ALIAS**
   - The alias of your signing key
   - Default: `greed-gross-key`

4. **KEY_PASSWORD**
   - The password for your signing key
   - Example: `your-key-password`

### Firebase Deployment Secrets

5. **FIREBASE_APP_ID**
   - Your Firebase Android app ID
   - Find in: Firebase Console > Project Settings > Your Apps
   - Format: `1:1234567890:android:abcdef1234567890`

6. **FIREBASE_SERVICE_ACCOUNT_JSON**
   - Service account JSON for Firebase
   - Steps to generate:
     1. Go to Firebase Console > Project Settings > Service Accounts
     2. Click "Generate new private key"
     3. Copy the entire JSON content
     4. Paste as secret value

### Optional Secrets

7. **SLACK_WEBHOOK** (optional)
   - For build notifications
   - Get from: Slack App > Incoming Webhooks

## Setting Up Secrets

1. Go to your repository on GitHub
2. Click Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with the exact name listed above

## Workflows Overview

### 1. Android Build & Release (`android-build.yml`)
- **Triggers**: Push to main, tags starting with 'v', PRs
- **Outputs**: Debug APK (PRs), Release APK/AAB (main/tags)
- **Auto-release**: Creates GitHub release for version tags

### 2. Firebase App Distribution (`firebase-deploy.yml`)
- **Triggers**: After successful build, manual trigger
- **Function**: Deploys APK to Firebase for testing
- **Groups**: Sends to 'internal-testers' group

### 3. Code Quality (`code-quality.yml`)
- **Triggers**: All PRs and pushes to main
- **Checks**: ESLint, security audit, code formatting
- **Reports**: Comments on PRs with results

## Creating a Release

1. Ensure all changes are committed and pushed
2. Create a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions will automatically:
   - Build release APK and AAB
   - Create GitHub release
   - Upload artifacts
   - Deploy to Firebase (if configured)

## Manual Deployment

To manually deploy to Firebase App Distribution:
1. Go to Actions tab
2. Select "Firebase App Distribution" workflow
3. Click "Run workflow"
4. Enter release notes
5. Click "Run workflow" button

## Troubleshooting

### Build Failures
- Check that all secrets are correctly set
- Ensure keystore file is valid
- Verify Java and Node versions match requirements

### Firebase Deployment Issues
- Confirm Firebase App ID is correct
- Verify service account has necessary permissions
- Check that app is registered in Firebase Console

### Code Quality Failures
- Run `npm run lint` locally to fix issues
- Use `npm audit fix` for security vulnerabilities
- Format code with Prettier before committing

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):
```bash
act -s KEYSTORE_BASE64="$(base64 -w 0 your-keystore.keystore)" \
    -s KEYSTORE_PASSWORD="your-password" \
    -s KEY_ALIAS="your-alias" \
    -s KEY_PASSWORD="your-key-password"
```

## Security Notes

- Never commit secrets or keystore files
- Rotate passwords periodically
- Use environment-specific keystores
- Keep service account permissions minimal
- Review workflow permissions regularly