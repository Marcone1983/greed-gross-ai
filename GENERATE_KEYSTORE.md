# Generate Release Keystore

## Create Production Keystore

Run this command to generate a release keystore for GREED & GROSS:

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/app/greed-gross-release-key.keystore \
  -alias greed-gross-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for:
1. **Keystore password**: Choose a strong password (save it!)
2. **Key password**: Can be same as keystore password
3. **Your name**: Your name or company name
4. **Organizational unit**: Development
5. **Organization**: GREED & GROSS
6. **City**: Your city
7. **State**: Your state/province
8. **Country code**: Your 2-letter country code (e.g., IT, US)

## Important Security Notes

⚠️ **NEVER COMMIT THE KEYSTORE FILE TO GIT!**

The `.gitignore` already excludes `*.keystore` files, but always double-check.

## After Generation

1. **Backup your keystore** in multiple secure locations
2. **Save the passwords** in a password manager
3. **Generate base64** for GitHub Actions:
   ```bash
   base64 -w 0 android/app/greed-gross-release-key.keystore
   ```
4. **Add to GitHub Secrets**:
   - KEYSTORE_BASE64: The base64 output
   - KEYSTORE_PASSWORD: Your keystore password
   - KEY_ALIAS: greed-gross-key
   - KEY_PASSWORD: Your key password

## Update Gradle Configuration

Add to `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

Add to `android/gradle.properties`:

```properties
MYAPP_RELEASE_STORE_FILE=greed-gross-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=greed-gross-key
MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password
MYAPP_RELEASE_KEY_PASSWORD=your-key-password
```

⚠️ **Never commit gradle.properties with passwords!** Use environment variables in CI/CD.