# 🚀 NeuroRead Installation Guide

## Quick Start (5 minutes)

### Step 1: Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. The NeuroRead icon should appear in your toolbar!

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
2. Click the NeuroRead icon in your toolbar
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
| `Alt + E` | Toggle Eye Tracking |
| `Shift + Esc` | Reset All |

---

## Troubleshooting

### Extension not loading?
- Make sure Developer mode is enabled
- Check that you selected the correct folder
- Try refreshing the extensions page

### Backend not starting?
- Check if port 3000 is available
- Make sure Node.js is installed
- Run `npm install` first

### Features not working?
- Check browser console for errors
- Ensure you have the latest Chrome version
- Try refreshing the page

---

## Need Help?

Contact us or check the documentation!
