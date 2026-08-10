# 🚀 SETU Installation Guide

## Quick Start (5 minutes)

### Step 1: Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. The SETU icon should appear in your toolbar!

### Step 2: Start Backend (Optional - for AI features)

```bash
cd backend
npm install
npm start
```

The backend will start on `http://localhost:3000`

### Step 3: Start Dashboard (Optional)

```bash
cd frontend
npm install
npm start
```

The dashboard will open at `http://localhost:3001`

---

## Testing the Extension

1. Open the demo page: `demo-assets/demo-page.html`
2. Click the SETU icon in your toolbar
3. Try different features:
   - Toggle **Bionic Reading**
   - Enable **Focus Mode**
   - Try **Auto Scroll**
   - Test **Text to Speech**

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + B` | Toggle Bionic Reading |
| `Alt + F` | Toggle Focus Mode |
| `Alt + S` | Toggle Auto Scroll |
| `Alt + T` | Toggle Text to Speech |
| `Alt + Shift + C` | Open SETU Commander |

---

## Troubleshooting

- **Extension not working on new tab page?** Chrome restricts extensions on internal pages (`chrome://`). Try a normal website.
- **Backend API not connecting?** Ensure `http://localhost:3000` is running. SETU features work offline automatically using local L0 fallbacks.
