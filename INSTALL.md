# NeuroRead Installation Guide

## Quick Start Guide

### Step 1: Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. The NeuroRead extension icon will appear in your toolbar!

### Step 2: Start Backend API (Optional - for Cloud AI Features)

```bash
cd backend
npm install
npm start
```

The backend server will start on `http://localhost:3000`.

### Step 3: Start Web Dashboard (Optional)

```bash
cd frontend
npm install
npm start
```

The dashboard will open at `http://localhost:3001`.

---

## Testing the Extension

1. Open the demo page: `demo-assets/demo-page.html`
2. Click the **NeuroRead** icon in your Chrome toolbar.
3. Try any of the 8 Reading Supports:
   - Toggle **Bionic Reading**
   - Enable **Focus Mode**
   - Test **Eye Tracking**
   - Try **Auto Scroll**
   - Activate **Text to Speech**
   - Turn on **Line Ruler**
   - Test **Dyslexia Font Theme**
   - Click **AI Summarizer**

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + B` | Toggle Bionic Reading |
| `Alt + F` | Toggle Focus Mode |
| `Alt + E` | Toggle Eye Tracking |
| `Alt + S` | Toggle Auto Scroll |
| `Alt + T` | Toggle Text to Speech |
| `Alt + H` | Toggle Reading Line Ruler |
| `Alt + A` | Trigger AI Summarizer |

---

## Troubleshooting

- **Extension not working on Chrome internal pages?** Chrome restricts content scripts on system pages (`chrome://`). Test on standard web pages or `demo-assets/demo-page.html`.
- **Backend API not connecting?** Ensure `http://localhost:3000` is running or update the Backend API URL in the extension Settings tab. NeuroRead features automatically degrade to zero-latency L0 local fallbacks offline.
