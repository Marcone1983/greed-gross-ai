# 🌿 GREED & GROSS - Cannabis Breeding AI Simulator

## 📱 Overview
GREED & GROSS is a professional cannabis breeding simulator powered by GPT-4 AI. The app provides expert knowledge on cannabis genetics, breeding techniques, and strain information.

## 🚀 Quick Start

### Prerequisites
- Android device with Termux (from F-Droid)
- GitHub account
- Basic knowledge of terminal commands

### Setup in Termux

1. **Install required packages:**
```bash
pkg update && pkg upgrade
pkg install git nodejs npm openjdk-17
```

2. **Clone the repository:**
```bash
cd ~/storage/shared
git clone https://github.com/YOUR_USERNAME/greed-and-gross.git
cd greed-and-gross
```

3. **Run setup script:**
```bash
chmod +x setup.sh
./setup.sh
```

## 🔑 Configuration

### Firebase Setup
The app uses Firebase project `linkbridge-80cda` with:
- **Project ID**: linkbridge-80cda
- **App ID**: 1:616726949995:android:fe1e2be607329a7647012e
- **Package Name**: com.linkbridge.app

### OpenAI API
The app uses GPT-4o-mini model. API key is stored in `.env` file.

## 🏗️ Building

### Local Build (Termux)
```bash
cd android
./gradlew bundleRelease
```

### GitHub Actions Build
1. Push code to GitHub
2. Go to Actions tab
3. Download AAB from artifacts

## 📦 Project Structure
```
greed-and-gross/
├── App.js                    # Main app component
├── package.json              # Dependencies
├── .env                      # Environment variables
├── android/                  # Android native code
│   ├── app/
│   │   ├── build.gradle
│   │   ├── google-services.json
│   │   └── src/
│   └── build.gradle
└── .github/
    └── workflows/
        └── build.yml         # CI/CD configuration
```

## 🔐 Security

### Keystore Information
- **Alias**: greedandgross
- **Password**: greed123
- **Validity**: 10000 days

⚠️ **IMPORTANT**: Always backup your keystore file! Without it, you cannot update your app.

## 🌍 Features

### Multi-language Support
- 🇮🇹 Italian (Default)
- 🇬🇧 English
- 🇪🇸 Spanish

### Core Features
- AI-powered cannabis genetics expert
- Smart caching system to reduce API costs
- Conversation memory
- Dark mode support
- Admin panel (7-tap unlock)

### Screens
1. **Chat**: Main AI interaction
2. **Library**: Strain database
3. **Breeding**: Genetics simulator
4. **Premium**: Subscription management
5. **Settings**: App configuration

## 📊 Technical Details

### Dependencies
- React Native 0.72.0
- Firebase (Auth, Firestore, Storage, Analytics)
- OpenAI API (GPT-4o-mini)
- React Navigation
- i18next for translations

### API Endpoints
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o-mini`

## 🚀 Deployment

### Play Store Release
1. Build AAB using GitHub Actions
2. Download from Actions artifacts
3. Upload to Google Play Console
4. Fill required information:
   - App name: Greed & Gross
   - Category: Education
   - Content rating: Mature 17+

### Required Assets
- Icon: 512x512 PNG
- Feature graphic: 1024x500 PNG
- Screenshots: Min 2, Max 8 (per device type)

## 🛠️ Maintenance

### Update Dependencies
```bash
npm update
cd android && ./gradlew clean
```

### Clear Cache
```bash
cd android
./gradlew cleanBuildCache
```

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Email: support@greedandgross.com

## 📄 License

This project is proprietary software. All rights reserved.

---

**Built with ❤️ for the cannabis breeding community**
