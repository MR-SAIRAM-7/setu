# Testing NeuroRead in Chrome

Ten minutes, no keys, no database, no account required. All L0 features work with the network disconnected.

---

## 1. Load the Extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the **`chrome-extension`** directory.

You will see **NeuroRead — Web Accessibility & Cognitive Assistance Suite**.

---

## 2. Using the Extension

1. Open a web page (e.g. `demo-assets/demo-page.html` or any live website).
2. Click the **NeuroRead** icon in the toolbar.
3. Access the 8 On-Page Reading Supports and 7 Cognitive Modes:
   - **Bionic Reading** (`Alt + B`)
   - **Focus Mode** (`Alt + F`)
   - **Eye Tracking** (`Alt + E`)
   - **Auto Scroll** (`Alt + S`)
   - **Text to Speech** (`Alt + T`)
   - **Line Ruler** (`Alt + H`)
   - **Dyslexia Font Theme**
   - **AI Summarizer** (`Alt + A`)

---

## 3. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + B` | Toggle Bionic Reading |
| `Alt + F` | Toggle Focus Mode |
| `Alt + E` | Toggle Eye Tracking |
| `Alt + S` | Toggle Auto Scroll |
| `Alt + T` | Toggle Text to Speech |
| `Alt + H` | Toggle Reading Line Ruler |
| `Alt + A` | Trigger AI Summarizer |

---

## 4. Verification

- All raw text emojis have been replaced with clean inline SVG icons and Lucide React icons.
- All backend endpoints are dynamic and support `chrome.storage.sync` configuration.
- WCAG 2.1 AAA contrast ratios and 44px touch targets are enforced.
