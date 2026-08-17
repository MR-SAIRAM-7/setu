# SETU Android Application — Master Development Task Tracker

Living single source of truth for the SETU Android Mobile Application (React Native + TypeScript + Expo), connecting to the existing SETU FastAPI/Express AI Backend and MongoDB database.

---

## 1. Architecture & Repository Inspection
- [x] Inspect existing repository structure, design guidelines, backend routes, AI models, and frontend logic.
- [x] Document design tokens (Broadsheet design system: paper ground `#f3f2f2`, surface `#eae9e9`, ink `#201e1d`, cyan `#0088b0`, magenta `#d6006c`, yellow `#edbb00`, 4-plate mind map colors).
- [x] Identify reusable business logic (Layout algorithm, Bionic fixation math, TTS helper, Seed data, 7 Cognitive Modes).

## 2. Project Setup & Mobile Foundation
- [ ] Initialize React Native + TypeScript Expo application in `mobile/` with configuration for Android standalone builds.
- [ ] Configure `package.json`, `tsconfig.json`, `app.json` (Android package name `com.setu.sanctuary`, permissions for Camera, Audio, Storage).
- [ ] Install core dependencies: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `expo-font`, `expo-speech`, `expo-camera`, `expo-image-picker`, `expo-haptics`, `expo-file-system`, `@react-native-async-storage/async-storage`, `react-native-svg`, `react-native-gesture-handler`, `react-native-reanimated`, `lucide-react-native` / vector icons.
- [ ] Configure Broadsheet design system tokens, typography scales, fonts (Source Serif 4, Atkinson Hyperlegible, System Sans), and color palettes in `mobile/src/constants/theme.ts`.

## 3. Core Types, State Management & Contexts
- [ ] Define comprehensive TypeScript interfaces (`src/types/index.ts`) for MindMap, Node, Edge, 7 Modes, Chat Turn, Preferences, FileUpload, API contracts.
- [ ] Implement `AccessibilityContext` managing font family, text scaling (1.0x / 1.1x / 1.22x), motion reduction, bionic reading toggle, and reading ruler.
- [ ] Implement `FocusContext` managing the 25-minute ADHD Pomodoro timer, background interval, and break dialog state.
- [ ] Implement `IdentityContext` managing stable per-device `x-user-id` token persistence and MongoDB synchronization status.

## 4. Centralized API & Networking Layer
- [ ] Build `src/services/api.ts` connecting to SETU engine with automatic base URL fallback, timeouts, `x-user-id` header injection, and network error handling.
- [ ] Implement API endpoints matching backend:
  - System: `/api/health`, `/api/health/ai`, `/api/db/status`
  - Research & Mind Maps: `/api/research/mindmap`, `/api/research/expand`, `/api/mindmaps`
  - Chat & Streaming: `/api/chat`, `/api/conversations`
  - 7 Cognitive Modes: `/api/start`, `/api/simplify`, `/api/learn`, `/api/meet`, `/api/practice`, `/api/write`, `/api/guide`
  - File/Document OCR: `/api/files/upload`, `/api/agent/describe-image`
- [ ] Build `src/services/storage.ts` for offline-first local caching and seamless remote MongoDB synchronization.
- [ ] Build `src/services/tts.ts` for accessible text-to-speech audio playback with rate, pitch, and voice controls.

## 5. Reusable UI Design System Components
- [ ] Create `Text` / `Heading` components respecting accessibility settings and Broadsheet serif typography.
- [ ] Create `BionicText` component applying fixation anchor bolding on words for dyslexia/ADHD reading support.
- [ ] Create `Button` (Primary cyan, Secondary, Ghost, Destructive magenta) with accessible touch targets (>= 48px) and haptic feedback.
- [ ] Create `Card` and `Tag` components with Broadsheet 4-plate inks (`cyan`, `magenta`, `yellow`, `ink`).
- [ ] Create `Input` and `Textarea` components with clear focus states and high-contrast styling.
- [ ] Create `FocusTimerWidget` (sidebar/header floating timer widget) and `BreakDialogModal` ("That's twenty-five minutes. Take five / Keep going").
- [ ] Create `StagedLoader` component with 3 progressive stages (`Reading around topic` -> `Finding branches` -> `Drawing map`).
- [ ] Create `ReadingRuler` overlay component for line-by-line focus tracking.
- [ ] Create `VoiceInputButton` component for voice dictation / Speech-to-Text.

## 6. Onboarding & First-Run Experience (3-Step Flow)
- [ ] Build `OnboardingScreen` strictly matching design guidelines:
  - Step 1: "What tends to get in your way?" (ADHD, Dyslexia, Autistic, Just overwhelmed, Rather not say).
  - Step 2: "Make this paragraph easy to read" (Live sample with real-time typeface, size, and bionic reading preview).
  - Step 3: "Should things move?" (Let things move vs. Keep it still).
- [ ] Seamless transition into the app with seeded worked example map pre-loaded.

## 7. Home & Sanctuary Dashboard Screen
- [ ] Build `HomeScreen` featuring:
  - Engine Readiness Probe badge (breathing dot indicator).
  - Focus session quick launcher & status.
  - Cognitive Mode 7-card quick action grid.
  - "Ask anything" instant research bar + Voice input + Camera OCR trigger.
  - Recent mind maps & research history carousel.
  - Cognitive tips & accessibility quick toggles.

## 8. Interactive Mind Map & Research Screen
- [ ] Implement mobile-optimized `MindMapCanvas` using SVG + touch pan & zoom gestures:
  - Reingold-Tilford tree layout calculation (`src/utils/layout.ts`).
  - 4-plate branch coloring (`#0088b0`, `#d6006c`, `#edbb00`, `#201e1d`).
  - Collapsible branches with circular child count badge.
  - Accessible touch nodes with high contrast and selection ring.
- [ ] Build interactive `NodeDetailSheet` (bottom sheet / modal) with:
  - Branch details, key facts, and sources.
  - "Go one level deeper" (calls `/api/research/expand` dynamically).
  - "Ask about this node" conversational follow-up.
  - TTS read aloud for the node content.
- [ ] Staged progress indicator during research generation.
- [ ] Mind map export actions (Markdown, JSON, Text outline).

## 9. Seven Cognitive Accessibility Modes Screen
- [ ] Build `ModesScreen` with tab/list navigation for all 7 modes:
  - **Start**: Break task freeze (confidence meter, micro-steps, 10-min action).
  - **Simplify**: Plain language rewrite Grade 6, key takeaways, sensory tips.
  - **Learn**: Study summary, branching outline, interactive self-quiz with feedback.
  - **Meet**: Meeting rescue (summary, action items with owners/deadlines, decoded jargon).
  - **Practice**: Rehearse hard conversations (scenario, opening line, multiple tone options, coaching tips).
  - **Write**: Accessible writing check (readability grade, active rewrite, passive highlights, clarity fixes).
  - **Guide**: Step-by-step workflow (numbered steps, action required, success signals).
- [ ] Pre-populate worked examples for every mode so no screen is ever empty.
- [ ] Integrate live execution with backend API and fallback engine.
- [ ] Add TTS playback, Bionic reading toggle, and copy/export options for results.

## 10. Camera, OCR & Document Ingestion
- [ ] Build `CameraOcrScreen` with camera capture and photo library picker.
- [ ] Image preview with crop/focus guidance for physical documents, handouts, book pages, notices.
- [ ] Send image to backend `/api/agent/describe-image` / `/api/files/upload` for OCR text extraction.
- [ ] Action buttons on extracted text: "Simplify Text", "Generate Mind Map", "Study & Quiz", "Listen (TTS)".

## 11. Library & Conversation History Screen
- [ ] Build `LibraryScreen` displaying saved mind maps, conversation threads, and mode summaries.
- [ ] Search and filter by mode, date, and keyword.
- [ ] Seed reference library restoration ("Restore reference library").
- [ ] Delete and export options with confirmation dialogs.

## 12. Settings & Accessibility Customization Screen
- [ ] Build `SettingsScreen` with:
  - Reading preferences (Typeface, Size scale, Motion reduction, Bionic reading, Reading ruler).
  - Voice settings (Speech rate slider, pitch, voice test).
  - Engine & Backend configuration (Backend URL input, live `/api/health/ai` probe test).
  - Data management (Device ID display, Reset ID, Clear all local data, Restore demo library).
  - About SETU & Hackathon Disability Inclusion statement.

## 13. Navigation & App Shell
- [ ] Configure React Navigation with Broadsheet aesthetic (paper background, cyan active tabs, muted inactive labels).
- [ ] Navigation structure:
  - Root Stack: Onboarding -> MainTabs -> ModeDetail / CameraOCR / NodeDetail.
  - Main Tabs: Home, Mind Map, Modes, Library, Settings.
- [ ] Floating Focus Session Banner and Skip-to-Content accessible shortcuts.

## 14. Verification, Testing & Build Readiness
- [ ] Test all screens with TypeScript typechecking (`tsc --noEmit`).
- [ ] Test API integration against local/remote SETU backend.
- [ ] Verify offline fallback behavior when backend is unreachable.
- [ ] Verify WCAG 2.1 AA accessibility contrast, font scaling, screen reader labels, and touch targets.
- [ ] Test standalone Android APK build configuration (Expo EAS build / Prebuild).
- [ ] Write detailed run and demonstration guide for judges/evaluators in `mobile/README.md`.
