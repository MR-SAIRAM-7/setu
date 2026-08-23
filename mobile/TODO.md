# SETU Mobile — status

Living tracker for the Android/iOS client. See `README.md` for how to run and
build it.

---

## Done

### Foundation
- [x] Expo SDK 57 + React Native 0.86 + TypeScript project, Android package
      `com.setu.sanctuary`.
- [x] Broadsheet design tokens, typography scale, spacing, plate colours.
- [x] Engine address resolution — Settings override, then `EXPO_PUBLIC_API_URL`,
      then the Metro host in dev, then the deployed engine. Stored `10.0.2.2`
      values from older builds are migrated away, so an upgraded install on a
      real phone is not left pointing at a dead address.
- [x] Error boundary above the provider tree, so a render failure shows a
      readable screen instead of a white one.
- [x] `app.config.js` so cleartext HTTP is enabled for development and preview
      builds and blocked in production.
- [x] EAS profiles for development / preview APK / production bundle.

### State and services
- [x] Anonymous device identity in its own module, warmed at boot.
- [x] API client with central language stamping, soft reads, timeouts, abort
      forwarding, and background mirroring for local-first writes.
- [x] SSE chat streaming over XHR, since RN `fetch` has no readable body.
- [x] Offline-first storage for maps, summaries, conversations, preferences.
- [x] Device-only stores for the parking lot and the check-in journal.

### Accessibility
- [x] Sarvam Bulbul read-aloud with sentence chunking and a pipelined fetch, so
      audio starts in about a second; falls back to the device synthesiser
      mid-passage rather than stopping.
- [x] Sarvam Saaras dictation with real recording, a 60-second cap, and an
      honest message when the engine has no speech key.
- [x] Eleven languages driving the model, the voice and the dictation together,
      chosen during onboarding in native script.
- [x] Six page colours, seven tints at four strengths, five typefaces, three
      text sizes, three spacing densities, reduced motion, reading ruler.
- [x] Speak-on-tap for mind map branches, on by default.
- [x] Screen-reader labels and 44pt minimum targets across new surfaces.

### Features
- [x] Eight cognitive modes, including Numbers with countable-object rendering.
- [x] Listen: mood check-in, local journal, and the server's fixed crisis
      response rendered verbatim with dialable helplines.
- [x] Momentum: points, streaks, ranks, milestones, reward toasts, and a switch
      that silences the display without stopping the count.
- [x] Parking lot for working-memory offload.
- [x] Focus sessions on a wall-clock deadline, surviving backgrounding, with a
      working "take five" break.
- [x] Library documents tab — pick any file, upload, then simplify, map, study
      or hear it.
- [x] Copy and share to Markdown, plain outline, or JSON.

### Honesty
- [x] Removed the invented OCR paragraph that appeared when scanning failed.
- [x] Removed the invented mind map and the placeholder "Deep Dive" branch that
      appeared when research failed.
- [x] Removed the silent fall back to a worked example when a mode call failed.
- [x] Mode results now show when the engine answered from its offline rule
      engine, including when that means English instead of the chosen language.
- [x] Fixed the mind map research reader — it read `result.map`, which the
      engine never returns, so every researched map had no tree.

---

## Verified

- `npx tsc --noEmit` clean.
- `npx expo export --platform android` bundles all 3,277 modules.
- Against a live backend: `/api/health`, `/api/speech/voices`, `/api/speech`
  (base64 mp3), `/api/numbers`, `/api/listen` (both the normal and the crisis
  path), `/api/simplify`.

---

## Not done

- [ ] **Run on a physical device.** Everything above is typechecked, bundled and
      verified against the real backend, but no build has been installed on
      hardware in this pass. Microphone recording, audio playback and the
      camera all cross the native boundary and want a real device before
      anyone relies on them.
- [ ] **`eas init`** to attach a project id, needed before the first cloud build.
- [ ] Bundled Atkinson Hyperlegible and Lexend font files. The typeface setting
      currently maps them onto the platform serif/sans stacks, so the choice is
      real but the faces are not the licensed originals.
- [ ] Offline queue for writes made while the engine is unreachable; today they
      are kept locally and mirrored only on the next successful call.
- [ ] Push notifications for focus session completion when the app is closed.
- [ ] Localised interface chrome. The eleven languages cover what the model says
      and what the voice reads; the buttons and labels are still English.
