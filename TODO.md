# SETU Android Application — Master Development Task Tracker

Living single source of truth for the SETU Android Mobile Application (React Native + TypeScript + Expo SDK v57), connecting to the unified SETU Express AI Backend and MongoDB database shared across Web, Chrome Extension, and Mobile.

**Status: ✅ PHASES 1–13 (AND Complete Architecture 1–15) COMPLETE — Production Ready**  
**TypeScript: 0 errors (`npx tsc --noEmit`) across 36 source files**  
**Architecture: Shared Backend (`backend/`) for Chrome Extension, Web Application, and Mobile Application**  
**Dynamic Design: Zero hardcoded mock data; fully dynamic state, storage, and API synchronization**

---

## Unified Multi-Platform Ecosystem Architecture
```
                                ┌───────────────────────────────────────┐
                                │   Unified SETU Backend (Express.js)   │
                                │   - OpenRouter / Gemini AI Fallback   │
                                │   - MongoDB & Local Rule Engine       │
                                │   - Identity via x-user-id header     │
                                └──────────────────┬────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                │                                  │                                  │
  ┌─────────────▼────────────┐       ┌─────────────▼────────────┐       ┌─────────────▼────────────┐
  │     Chrome Extension     │       │     Web Application      │       │     Mobile Application   │
  │  - Content Script & DOM  │       │  - React 18 + Vite       │       │  - React Native + Expo   │
  │  - Lens Reading Tools    │       │  - Full Broadsheet Desk  │       │  - Touch Canvas & Haptics│
  │  - Handoff to Sanctuary  │       │  - SSE Streaming & Sync  │       │  - Offline-first Local DB│
  └──────────────────────────┘       └──────────────────────────┘       └──────────────────────────┘
```

---

## 1. Architecture & Repository Inspection ✅
- [x] Inspect existing repository structure, design guidelines, backend routes, AI models, and frontend logic.
- [x] Document design tokens (Broadsheet design system: paper ground `#f3f2f2`, surface `#eae9e9`, ink `#201e1d`, cyan `#0088b0`, magenta `#d6006c`, yellow `#edbb00`, 4-plate mind map colors).
- [x] Identify reusable business logic (Reingold-Tilford layout algorithm, Bionic fixation math, TTS helper, Seed data, 7 Cognitive Modes).

## 2. Project Setup & Mobile Foundation ✅
- [x] Initialize React Native + TypeScript Expo application in `mobile/` with configuration for Android standalone builds.
- [x] Configure `package.json`, `tsconfig.json`, `app.json` (Android package name `com.setu.sanctuary`, permissions for Camera, Audio, Storage).
- [x] Install core dependencies: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `expo-font`, `expo-speech`, `expo-camera`, `expo-image-picker`, `expo-haptics`, `expo-file-system`, `@react-native-async-storage/async-storage`, `react-native-svg`, `react-native-gesture-handler`, `react-native-reanimated`, `lucide-react-native`.
- [x] Configure Broadsheet design system tokens, typography scales, fonts (Source Serif 4, Atkinson Hyperlegible, System Sans), and color palettes in `mobile/src/constants/theme.ts`.

## 3. Core Types, State Management & Contexts ✅
- [x] Define comprehensive TypeScript interfaces (`src/types/index.ts`) matching Web & Backend contracts (MindMap, Node, Edge, 7 Modes, SSE Chat Events, Agent actions, Preferences, FileUpload, API contracts).
- [x] Implement `AccessibilityContext` managing font family, text scaling (1.0x / 1.1x / 1.22x), motion reduction, bionic reading toggle, and reading ruler.
- [x] Implement `FocusContext` managing the 25-minute ADHD Pomodoro timer, background interval, haptic feedback, and break dialog state.
- [x] Implement `IdentityContext` managing stable per-device `x-user-id` token persistence, MongoDB synchronization status, AppState background pause/resume, and 4-state engine health monitoring (`checking` | `ok` | `nokey` | `down`).

## 4. Centralized API & Networking Layer ✅
- [x] Build `src/services/api.ts` connecting to the shared SETU backend with automatic base URL fallback, timeouts, `x-user-id` header injection, and network error handling.
- [x] Implement complete API endpoint surface matching Web and Chrome Extension:
  - System: `/api/health`, `/api/health/ai`, `/api/db/status`
  - Research & Mind Maps: `/api/research/mindmap`, `/api/research/expand`, `/api/mindmaps`
  - Chat & Streaming: `/api/chat`, `/api/conversations`
  - 7 Cognitive Modes: `/api/start`, `/api/simplify`, `/api/learn`, `/api/meet`, `/api/practice`, `/api/write`, `/api/guide`
  - File/Document OCR: `/api/files/upload`, `/api/files`, `/api/agent/describe-image`
  - Settings & Summaries: `/api/settings`, `/api/summaries`, `/api/export`
- [x] Implement `syncInBackground()` for non-blocking fire-and-forget MongoDB synchronization.
- [x] Build `src/services/storage.ts` for offline-first local caching (AsyncStorage) and automatic remote MongoDB synchronization.
- [x] Build `src/services/tts.ts` for accessible text-to-speech audio playback with rate, pitch, and voice controls.
- [x] Build `src/services/summaryStorage.ts` for cognitive mode result persistence.
- [x] Build `src/services/networkMonitor.ts` for connectivity diagnostics with 3s abort timeout.

## 5. Reusable UI Design System Components ✅
- [x] Create `Text` / `Heading` / `Subheading` / `Kicker` components respecting accessibility settings and Broadsheet serif typography (`mobile/src/components/Typography.tsx`).
- [x] Create `BionicText` component applying fixation anchor bolding on words for dyslexia/ADHD reading support (`mobile/src/components/BionicText.tsx`).
- [x] Create `Button` (Primary cyan, Secondary, Ghost, Destructive magenta, Option) with accessible touch targets (>= 48px), haptic feedback, and accessibility attributes (`mobile/src/components/Button.tsx`).
- [x] Create `Card` and `Tag` components with Broadsheet 4-plate inks (`cyan`, `magenta`, `yellow`, `ink`) and accessibility roles (`mobile/src/components/Card.tsx`).
- [x] Create `Input` and `Textarea` components with clear focus states and high-contrast styling (`mobile/src/components/Input.tsx`).
- [x] Create `FocusTimerWidget` and `BreakDialogModal` ("That's twenty-five minutes. Take five / Keep going") (`mobile/src/components/FocusTimerWidget.tsx`, `mobile/src/components/BreakDialogModal.tsx`).
- [x] Create `StagedLoader` component with 3 progressive stages (`Reading around topic` -> `Finding branches` -> `Drawing map`) (`mobile/src/components/StagedLoader.tsx`).
- [x] Create `ReadingRuler` overlay component for line-by-line focus tracking (`mobile/src/components/ReadingRuler.tsx`).
- [x] Create `VoiceInputButton` component for voice dictation / Speech-to-Text (`mobile/src/components/VoiceInputButton.tsx`).
- [x] Create `EngineBadge` indicator with 4-state indicator and breathing dot animation (`mobile/src/components/EngineBadge.tsx`).
- [x] Create `MindMapCanvas` and `NodeDetailSheet` for interactive tree visualization and branch drill-down.

## 6. Onboarding & First-Run Experience (3-Step Flow) ✅
- [x] Build `OnboardingScreen` strictly matching design guidelines:
  - Step 1: "What tends to get in your way?" (ADHD, Dyslexia, Autistic, Just overwhelmed, Rather not say).
  - Step 2: "Make this paragraph easy to read" (Live sample with real-time typeface, size, and bionic reading preview).
  - Step 3: "Should things move?" (Let things move vs. Keep it still).
- [x] Seamless transition into the app with seeded worked example map pre-loaded.

## 7. Home & Sanctuary Dashboard Screen ✅
- [x] Build `HomeScreen` featuring:
  - Engine Readiness Probe badge with 4-state live health indicator.
  - Quick accessibility toggles ribbon (Bionic reading, Reading ruler, TTS audio).
  - Quick stats summary row (Total maps, Focus sessions, Modes count, 0 bytes uploaded privacy indicator).
  - Focus session Pomodoro widget launcher & status.
  - Hero research prompt bar + Voice dictation + Camera OCR scanner trigger.
  - 7 Cognitive Mode quick action cards with worked examples.
  - Daily rotating cognitive accessibility tip card.
  - Recent researched mind maps carousel with relative date formatting and empty state CTA.

## 8. Interactive Mind Map & Research Screen ✅
- [x] Implement mobile-optimized `MindMapCanvas` using SVG + touch pan & zoom gestures:
  - Reingold-Tilford tree layout calculation (`mobile/src/utils/layout.ts`).
  - 4-plate branch coloring (`#0088b0`, `#d6006c`, `#edbb00`, `#201e1d`).
  - Collapsible branches with circular child count badge.
  - Accessible touch nodes with high contrast and selection ring.
- [x] Build interactive `NodeDetailSheet` with branch details, deep expansion (`/api/research/expand`), conversational Q&A, and TTS read aloud.

## 9. Seven Cognitive Accessibility Modes Screen ✅
- [x] Build `ModesScreen` with tab/list navigation for all 7 modes:
  - **Start**: Break task freeze (confidence meter, micro-steps, 10-min action).
  - **Simplify**: Plain language rewrite Grade 6, key takeaways, sensory tips.
  - **Learn**: Study summary, branching outline, interactive self-quiz with feedback.
  - **Meet**: Meeting rescue (summary, action items with owners/deadlines, decoded jargon).
  - **Practice**: Rehearse hard conversations (scenario, opening line, multiple tone options, coaching tips).
  - **Write**: Accessible writing check (readability grade, active rewrite, passive highlights, clarity fixes).
  - **Guide**: Step-by-step workflow (numbered steps, action required, success signals).
- [x] Dynamically save all mode results to AsyncStorage & MongoDB (`saveSummaryAndSync`).
- [x] Support prefilled inputs from OCR and other screens (`initialInput`).

## 10. Camera, OCR & Document Ingestion ✅
- [x] Build `CameraOcrScreen` with camera capture and photo library picker.
- [x] Image preview with crop/focus guidance for physical documents, book pages, handouts.
- [x] Send image to backend `/api/agent/describe-image` or `/api/files/upload` for OCR text extraction.
- [x] Quick actions on extracted text with parameter handoff to Simplify, Mind Map, and Learn modes.

## 11. Library & Stored Knowledge Vault Screen ✅
- [x] Build dynamic multi-tab `LibraryScreen`:
  - Tab 1: **Mind Maps** (Researched & Reference Seeds with 4-plate borders and relative date formatting).
  - Tab 2: **Mode Results** (Dynamically listed from `getSavedSummaries()`, searchable, with "Reopen mode").
- [x] Keyword search across all maps and saved mode results.
- [x] Seed reference library restoration ("Restore seeds").
- [x] Deletion with confirmation dialogs and haptics.

## 12. Settings & Accessibility Customization Screen ✅
- [x] Build dynamic `SettingsScreen` with:
  - Reading preferences (Typefaces, Text scaling, Motion sensitivity, Bionic reading, Reading ruler).
  - Speech synthesis controls (Speed & Pitch controls with live audio test).
  - Dynamic Engine & Backend configuration (Backend URL input, live `/api/health/ai` probe test).
  - Anonymous Device ID display, Reset ID, and Wipe All Local Data with confirmation dialogs.
  - About SETU & Hack4Positive statement.

## 13. Navigation & App Shell ✅
- [x] Configure React Navigation with Broadsheet aesthetic (paper background, cyan active tabs, muted inactive labels).
- [x] Dynamic Navigation Structure:
  - Root Stack: Onboarding -> MainTabs -> CameraOCR.
  - Main Tabs: Home, Mind Map, Modes, Library, Settings.
- [x] Floating persistent Focus Session Banner across all tabs when Pomodoro timer is active.
- [x] Global Floating Reading Ruler Overlay and Break Dialog Modal.

## 14. Verification, Testing & Build Readiness ✅
- [x] Test all screens with TypeScript typechecking (`npx tsc --noEmit` passed with 0 errors).
- [x] Test API integration against local SETU backend.
- [x] Verify offline fallback behavior when backend is unreachable.
- [x] Verify WCAG 2.1 AA accessibility contrast, font scaling, screen reader labels, and touch targets (>= 48px).

## 15. Production Hardening & Integration Polish ✅
- [x] Unified API client in `src/services/api.ts` with `soft` error suppression, timeout control, and `syncInBackground` mirror sync.
- [x] Full TypeScript type coverage in `src/types/index.ts` synchronized with Web frontend and Backend schemas.
- [x] Storage persistence in `src/services/storage.ts` with `AsyncStorage` + MongoDB synchronization.
- [x] Tested clean build with 0 errors across 36 TypeScript source files.
