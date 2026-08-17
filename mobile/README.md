# SETU Sanctuary — Android Mobile Application

**A bridge between dense digital worlds and the neurodivergent mind.**

The official React Native + TypeScript Android mobile client for the SETU Cognitive Ecosystem (Capgemini Hack4Positive 2026).

---

## 1. System Architecture

```
                                  ┌─────────────────────────────┐
                                  │      React Native App       │
                                  │  (Expo SDK / Android APK)   │
                                  └──────────────┬──────────────┘
                                                 │ HTTPS REST API
                                                 ▼
┌───────────────────────────┐      ┌─────────────────────────────┐      ┌───────────────────────────┐
│     SETU Lens Extension   ├─────►│     SETU Express Engine     │◄─────┤    SETU Sanctuary Web     │
│    (Chrome / Chromium)    │      │  (FastAPI / AI Orchestrator)│      │     (React 18 + Vite)     │
└───────────────────────────┘      └──────────────┬──────────────┘      └───────────────────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │    MongoDB Atlas Cluster    │
                                   │  + OpenRouter Multi-Model   │
                                   └─────────────────────────────┘
```

The Android app communicates purely as a client via HTTPS REST endpoints with the existing backend engine (`backend/server.js`). It never connects directly to MongoDB and never bundles private LLM API keys or secrets inside the mobile package.

---

## 2. Broadsheet Design System & Accessibility Core

The mobile interface is strictly bound to the **Broadsheet newsprint design guidelines**:
- **Light by default**: Near-black ink (`#201e1d`) on paper ground (`#f3f2f2`).
- **Four process plate inks**: Cyan (`#0088b0`), Magenta (`#d6006c`), Yellow (`#edbb00`), and Ink (`#201e1d`).
- **Accessible Typography**: Supports Source Serif 4 (default), Atkinson Hyperlegible (dyslexia-friendly letterforms), and System Sans with dynamic text scaling (`Normal 1.0×`, `Comfortable 1.1×`, `Large 1.22×`).
- **Bionic Reading Engine**: Calculates fixation anchor bolding on words to accelerate saccadic eye jumping and reduce cognitive fatigue for dyslexic readers.
- **Reading Ruler Overlay**: A draggable, high-contrast visual focus band that darkens outer lines to eliminate paragraph crowding.
- **ADHD Focus Session**: A 25-minute countdown timer with a warm, encouraging break dialog ("That's twenty-five minutes. Take five / Keep going").
- **Voice Feedback & Speech Synthesis**: Full text-to-speech reading with configurable rate, pitch, and voice controls.
- **Camera OCR & Ingestion**: Direct camera document capture with instant optical character recognition and semantic simplification.

---

## 3. Seven Cognitive Accessibility Modes

| Mode | Plate Tint | Purpose | Output Structure |
| :--- | :--- | :--- | :--- |
| **Start** | Yellow | Break task freeze & executive paralysis | Supportive message, Confidence meter, 10-minute physical action, Micro-steps |
| **Simplify** | Cyan | Plain language rewriting (Grade 6) | Readability grade, Plain-language rewrite, Key takeaways, Sensory tips |
| **Learn** | Magenta | Study material synthesis & self-quiz | Conceptual summary, Branching topic outline, Interactive 4-option quiz |
| **Meet** | Cyan | Meeting rescue & transcript decoding | Executive summary, Action items with owners/deadlines, Jargon decoded |
| **Practice** | Magenta | Rehearse difficult conversations | Scenario context, Opening lines, Suggested scripts across multiple tones |
| **Write** | Yellow | Accessible writing check | Reading grade level, Active voice rewrite, Passive voice highlights, Clarity fixes |
| **Guide** | Ink | Step-by-step workflow breakdown | Workflow name, Numbered steps, Required actions, Success signals/tips |

Every mode ships with pre-populated worked examples so the screen is never blank upon first opening.

---

## 4. How to Run the Mobile App

### Prerequisites
- Node.js 18+
- npm 9+
- Expo Go app on your Android device (or an Android Emulator / USB debugged device)

### Step 1: Start the SETU Backend Server
In the project root:
```powershell
cd D:\PROJECTS\setu\backend
npm start
```
The server runs on `http://localhost:3000`.

### Step 2: Start the Expo Development Server
In another terminal:
```powershell
cd D:\PROJECTS\setu\mobile
npm start
```

### Step 3: Run on Android

#### Option A: Physical Android Phone via Expo Go
1. Install **Expo Go** from the Google Play Store on your phone.
2. Ensure your phone and development computer are connected to the same Wi-Fi network.
3. Scan the QR code displayed in your terminal with the Expo Go app.
4. In the app's **Settings** tab, configure the **Backend Server URL** to your computer's LAN IP (e.g., `http://192.168.1.50:3000`).

#### Option B: Android Emulator
```powershell
cd D:\PROJECTS\setu\mobile
npm run android
```
*(The emulator automatically routes to the host backend via `http://10.0.2.2:3000`)*

---

## 5. Building a Standalone Android APK

To generate a standalone APK that can be installed directly on any physical Android phone without needing Expo Go or Google Play Store:

### Method 1: Cloud Build with Expo EAS (Recommended)
```powershell
# Install EAS CLI globally if needed
npm install -g eas-cli

# Log in to Expo account
eas login

# Build a standalone Android APK
eas build -p android --profile preview
```
EAS will produce a shareable direct APK download link that testers and judges can install with one tap.

### Method 2: Local Gradle APK Build
```powershell
# Generate native Android project files
npx expo prebuild --platform android

# Compile debug APK
cd android
./gradlew assembleDebug
```
The resulting APK is located at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 6. Live Hackathon Demo Walkthrough for Judges

1. **First Launch & Onboarding (3-Step Flow)**:
   - Step 1: Select cognitive barriers (e.g. *ADHD* and *Dyslexia*).
   - Step 2: Customize live reading sample (test *Atkinson Hyperlegible* font, *Large* scaling, and *Bionic Reading*).
   - Step 3: Choose motion sensitivity (*Let things move*).
2. **Interactive Mind Map Exploration**:
   - Tap on the pre-loaded *"Transformer neural networks"* reference map.
   - Pan and zoom around the canvas.
   - Tap on a branch node (e.g., *"Self-attention"*) to open the detail sheet.
   - Tap **"Listen"** to hear speech synthesis.
   - Tap **"Expand deeper"** to dynamically generate child research branches.
3. **Cognitive Tools in Action**:
   - Navigate to the **Modes** tab.
   - Tap **Simplify** to view a Grade 6 plain language rewrite.
   - Tap **Learn** and take the interactive knowledge quiz.
   - Tap **Start** to see the 10-minute micro-action breakdown for executive freeze.
4. **Camera OCR Document Scanning**:
   - Open **Scan Document OCR** from the Home tab.
   - Capture a photo of a document or pick a sample image.
   - View the extracted text and tap **"Simplify in plain language"** or **"Generate interactive mind map"**.
5. **ADHD Focus Session**:
   - Start the 25-minute focus timer on the Home screen.
   - Experience the tabular countdown and warm break dialog.
