# Shield Our Elders Mobile App

Shield Our Elders is a mobile scam-safety app designed for older adults and the trusted people who support them. The app helps users slow down during suspicious calls, texts, emails, QR codes, payment requests, and voicemail messages. Instead of giving a vague warning, it shows plain-language red flags and simple next steps, such as hanging up, avoiding links, not sending money, and calling a trusted contact or an official company number.

The app is built around older-adult usability needs: large touch targets, high-contrast text, short instructions, simple navigation, and one task at a time. The home screen starts with three clear instructions, a large emergency scam button, and only the most important actions: check a message, answer call-safety questions, or contact a trusted person.

## Key Features

- Emergency scam button with immediate safety steps
- Message, email, screenshot, and transcript checks
- Call checklist for money, secrecy, verification codes, remote access, and threats
- Trusted contact calling and texting
- Link and QR code checks before opening suspicious sites
- Family voice-clone warning and verification phrase support
- Payment safety checks for gift cards, crypto, wire transfers, Zelle, Cash App, and Venmo
- Scam alerts, short lessons, practice examples, and recovery steps
- Local-first storage for trusted contacts and practice progress
- Optional Hugging Face SMS spam check for pasted message text
- Hugging Face screenshot text extraction for OCR
- Hugging Face voicemail audio transcription
- Optional AI screenshot review when an OpenAI vision model is configured

## Development

```bash
npm install
npm run typecheck
npm run test:scams
npx expo start
```

## Platform Folders

The shared app code lives at the repo root in `App.tsx` and `src/`.

- `android/` contains the native Android project.
- `ios/` contains the native Apple/iOS Xcode project.

When app configuration changes, regenerate both native folders with:

```bash
npx expo prebuild --platform all
```

For Android emulator testing, open the Expo URL in Expo Go or run the app through Android Studio/Expo tooling.

For iOS simulator testing, install Xcode, accept the Xcode license, then run:

```bash
npm run ios
```

To generate the native iOS project locally for an Xcode build, run:

```bash
npm run prebuild:ios
npm run run:ios
```

## Optional Model Checks

The app works without model keys using the local scam checker.

To enable Hugging Face model checks for pasted text, screenshots, and voicemail files, copy `.env.example` to `.env` and set:

```bash
EXPO_PUBLIC_HUGGINGFACE_API_KEY=your_hf_token_here
EXPO_PUBLIC_HUGGINGFACE_MODEL=mrm8488/bert-tiny-finetuned-sms-spam-detection
EXPO_PUBLIC_HUGGINGFACE_CLASSIFIER_MODELS=mrm8488/bert-tiny-finetuned-sms-spam-detection
EXPO_PUBLIC_HUGGINGFACE_SCAM_REVIEW_MODEL=google/gemma-4-31B-it:cerebras
EXPO_PUBLIC_HUGGINGFACE_OCR_MODEL=google/gemma-4-31B-it:cerebras
EXPO_PUBLIC_HUGGINGFACE_ASR_MODEL=openai/whisper-large-v3-turbo
```

The pasted-text check can combine multiple Hugging Face classifiers with the scam review model. Screenshot OCR first extracts visible words, then the text check can score that text. Audio transcription fills the voicemail transcript box before analysis.

To enable the separate OpenAI screenshot review, set `EXPO_PUBLIC_OPENAI_API_KEY` as well.

For a real public release, do not ship private API keys inside the Android app. Put model calls behind a small server endpoint and have the app call that server instead.
