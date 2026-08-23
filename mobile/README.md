# SETU Mobile

The Android/iOS client for SETU — a cognitive accessibility tool for ADHD,
dyslexic, dyscalculic and autistic adults. React Native + TypeScript on Expo
SDK 57, talking to the same Express engine and MongoDB as the web app and the
Chrome extension.

---

## Running it

```bash
npm install
```

```bash
npm start
```

Then press `a` for an Android emulator, or scan the QR code with Expo Go on a
phone.

### Pointing it at an engine

You should not have to configure anything. The app resolves its backend in this
order, and the first answer wins:

1. an address typed into **Settings → Engine address**;
2. `EXPO_PUBLIC_API_URL`, set per profile in `eas.json`;
3. `extra.apiUrl` from `app.config.js`;
4. in development, the host Metro served the bundle from, on port 3000 — so a
   phone in Expo Go finds the laptop's backend by itself, and an emulator gets
   `10.0.2.2:3000`;
5. the deployed engine, `https://setu-37hl.onrender.com`.

To run against a local backend:

```bash
cd ../backend && npm start
```

Leave **Settings → Engine address** empty and it will be found automatically.
Cleartext HTTP is enabled for `development` and `preview` builds only, since
LAN backends are plain `http://`; production builds block it.

---

## Building

```bash
npx eas build --profile preview --platform android
```

`preview` produces an installable APK pointed at the deployed engine.
`production` produces an app bundle for Play. Both are configured in
`eas.json`; `npx eas init` will add the project id on first use.

### Checks

```bash
npx tsc --noEmit
```

```bash
npx expo export --platform android
```

The export is the useful one before a build — it resolves every module, so it
catches import mistakes that typechecking alone will not.

---

## What is in here

### Screens

| Screen | What it is for |
| --- | --- |
| **Home** | Ask a question, scan a page, pick a mode, pick up a recent map. Quick reading toggles near the top. |
| **Mind map** | Any topic drawn as a branching map. Tap a branch to open *and hear* it, go a level deeper, or ask about it — the chat turn streams. |
| **Modes** | Eight cognitive tools: Start, Simplify, Learn, Meet, Practice, Write, Guide, Numbers. |
| **Listen** | Reflective support with a mood check-in and a local-only journal. |
| **Library** | Saved maps, saved mode results, and uploaded documents. |
| **Settings** | Typeface, size, page colour, spacing, tint, language, voice, engine, data. |
| **Momentum** | Points, streak and milestones. Reachable from Home and Settings. |
| **Camera OCR** | Photograph a printed page and work with the text. |

### Accessibility

- **Read aloud** in eleven languages via Sarvam Bulbul, falling back to the
  phone's own synthesiser. Long passages are chunked and pipelined, so audio
  starts in about a second rather than after the whole passage synthesises.
- **Dictation** via Sarvam Saaras, available anywhere there is a text field.
- **Speak-on-tap** for mind map branches, on by default.
- **Six page colours** including two dark grounds and a high-contrast yellow.
- **Seven colour tints** at four strengths, for visual stress.
- **Five typefaces**, three text sizes, three line-spacing densities.
- **Reading ruler**, **reduced motion**, and optional bolded word starts.
- Every control has a screen-reader label; touch targets are at least 44pt.

### Elsewhere in the app

- **Focus sessions** run on a wall-clock deadline, so they keep counting while
  you are in another app.
- **The parking lot** (the pin button) is a one-tap place to put an intrusive
  thought. Notes never leave the phone.
- **Momentum** pays out immediately for real effort, and can be silenced
  without stopping the count.

---

## How it is put together

```
src/
  constants/    config (engine resolution), languages, theme tokens, palettes
  context/      preferences, theme, focus timer, identity
  services/     api, identity, tts, stt, storage, progress, localStore, export
  components/   design system + feature components
  screens/      one file per screen
  navigation/   tabs, stack, and the overlays that sit above them
```

Three things are worth knowing before changing anything:

**Styles are theme factories.** React Native evaluates `StyleSheet.create` once
at module load, so a palette read there is frozen for the life of the process.
Screens therefore declare `const makeStyles = (t: Palette) => StyleSheet.create({…})`
and call `useThemedStyles(makeStyles)`. Inline colours in the render body come
from `useThemeColors()`.

**Preferences are pushed, not pulled.** `AccessibilityContext` writes the
language, voice, pace, rewards switch and engine address into the service
modules whenever they change. Those modules never read storage themselves —
that is what keeps the API, the voice and the model in the same language.

**Nothing is ever invented.** When the engine cannot be reached, screens say so
and keep what the user typed. When the engine answers from its own offline
engine rather than a model, the mode result says that too, including when it
means the answer came back in English instead of the chosen language. Earlier
builds filled these gaps with canned text, which is the worst possible failure
for a reader who cannot easily evaluate what they are given.

---

## Privacy

There are no accounts. Identity is one random token per install, sent as
`x-user-id`, and it can be reset or wiped from Settings. Check-in entries and
parked notes are stored on the device only and are never mirrored to the server.
Documents and mind maps are mirrored so they follow you across devices.

The crisis path in Listen is decided on the server before any model is called,
and this app renders that fixed, reviewed response verbatim — with the helpline
numbers made dialable.
