# NeuroRead - Hackathon Pitch & Strategy Brief

## Problem Statement
**Problem Statement 01: NeuroInclusive Tech** - Making digital content readable and accessible for ADHD and Dyslexic minds.

---

## The Problem

### Current State
- Most digital content presents a daunting **wall of text**.
- Standard fonts, tight line spacing, and dense layouts cause severe **reading fatigue** and visual crowding.
- The brain skips lines, loses fixations, and faces executive dysfunction task freeze.
- **1 in 5 people** worldwide have ADHD or Dyslexia.
- **70% of websites** suffer from critical accessibility issues.

### Real-World Impact
- Students struggle with dense online learning materials and research papers.
- Professionals face productivity blocks and career limitations.
- Daily information consumption becomes mentally exhausting.
- Social exclusion from digital culture and complex online portals.

---

## Our Solution: NeuroRead

### A Unified Accessibility Platform & Chrome Extension That Adapts the Web to Your Cognitive Wiring

**Eight Core Reading Supports:**

1. **Bionic Reading**
   - Bolds the first half of words to create visual anchor points.
   - Guides the eye through text and reduces line skipping.

2. **Focus Mode**
   - Strips away visual distractions, ads, sidebars, and popups.
   - Delivers a clean, customizable reading canvas.

3. **Eye Tracking**
   - Webcam-based gaze detection for hands-free reading.
   - Automatically scrolls as your eyes move down the page.

4. **Auto Scroll**
   - Adaptive reading speed scrolling with customizable Words Per Minute (WPM).
   - Spacebar pause and keyboard speed control.

5. **Text to Speech (TTS)**
   - Natural Web Speech synthesis with real-time word highlighting.
   - Variable voice rate and pitch control.

6. **Word Highlight / Reading Line Ruler**
   - Moving spotlight ruler guides reading line-by-line.
   - Prevents loss of place when concentration wanders.

7. **AI Summarizer**
   - Condenses lengthy articles into concise key takeaways in seconds.
   - Powered by dynamic AI backend endpoints.

8. **Accessibility Themes**
   - 5 curated color palettes (Default, Sepia Warmth, Dark Obsidian, High Contrast AAA, and Dyslexia-Friendly with OpenDyslexic font).

---

## Why NeuroRead Stands Out

### 1. Real Impact
- Directly addresses a genuine problem affecting over 1.5 billion neurodivergent individuals worldwide.
- Delivers immediate, tangible accessibility improvements across any website.

### 2. Technical & Architectural Excellence
- Works across all websites without requiring account registration.
- Privacy-first local processing with deterministic L0 fallbacks.
- Chrome Extension Manifest V3 compliant.
- Modular React dashboard and Express backend.

### 3. Innovation
- Computer vision webcam eye tracking without expensive external hardware.
- Adaptive scrolling tailored to user reading velocity.
- Structured AI schema generation for mind maps and quizzes.

### 4. Accessibility First
- Fully keyboard navigable (Alt+B, Alt+F, Alt+E, Alt+S, Alt+T, Alt+H, Alt+A).
- Screen reader compatible and WCAG 2.1 AAA compliant contrast ratios.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Popup UI  │  │   Content   │  │ Background  │     │
│  │  (JS/HTML)  │  │   Scripts   │  │   Worker    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                │              │
│         └────────────────┴────────────────┘              │
│                          │                               │
│              ┌───────────┴───────────┐                   │
│              │   Feature Modules     │                   │
│              │ • Bionic Reading      │                   │
│              │ • Focus Mode          │                   │
│              │ • Eye Tracker         │                   │
│              │ • Auto Scroll         │                   │
│              │ • Text to Speech      │                   │
│              │ • Word Highlight      │                   │
│              │ • Dyslexia Theme      │                   │
│              └───────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
                           │
                           │ API Calls
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   NODE.JS BACKEND                        │
│              ┌─────────────────────┐                    │
│              │   Express Server    │                    │
│              │   Port: 3000        │                    │
│              └─────────────────────┘                    │
│                         │                               │
│              ┌──────────┴──────────┐                    │
│              │      Endpoints      │                    │
│              │ • /api/start        │                    │
│              │ • /api/simplify     │                    │
│              │ • /api/learn        │                    │
│              │ • /api/meet         │                    │
│              │ • /api/practice     │                    │
│              │ • /api/write        │                    │
│              │ • /api/guide        │                    │
│              │ • /api/agent/navigate│                   │
│              └─────────────────────┘                    │
│                         │                               │
│              ┌──────────┴──────────┐                    │
│              │  Gemini / OpenAI    │                    │
│              └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Feature Comparison

| Feature | NeuroRead | Competitors |
|---------|-----------|-------------|
| Bionic Reading | Built-in | Separate plugin |
| Eye Tracking | Webcam-based | Expensive hardware required |
| AI Summarizer & Mind Maps | Included | Paid subscription |
| Focus Mode | One-click | Manual adblockers |
| Works Everywhere | Any website | Restricted portals |
| Privacy | Local-first processing | Cloud-dependent data tracking |
| Price | Free & Open | High monthly fees |

---

## Team & Presentation

Built for Hack for Infinity - Infinity 2K26.

**Problem Statement:** PS 01 - NeuroInclusive Tech

---

**Thank you for your review!**
