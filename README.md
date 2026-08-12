<div align="center">

# NeuroRead — Web Accessibility & Cognitive Assistance Suite

**Making the Web Accessible for ADHD & Dyslexic Minds.**

One Unified Engine, 8 Core Reading Supports, 7 Cognitive Accessibility Modes. Built for Infinity Hackathon 2026 · Problem Statement 01: NeuroInclusive Tech.

</div>

---

## Executive Summary

> Dense digital interfaces impose a cognitive load that exceeds the working memory and executive initiation capacity of 15–20% of users. Standard websites and heavy portals create reading fatigue, visual crowding, and executive dysfunction freeze.
> **NeuroRead** replaces fragmented single-purpose tools with one unified, production-ready platform that transforms web content into structured, accessible, and actionable next steps.

---

## Eight Powerful Reading Tools (From Presentation Specification)

1. **Bionic Reading**: Bold the first half of words to create visual anchor points. Proven to improve reading speed and comprehension for ADHD and Dyslexic readers.
2. **Focus Mode**: Strip away distractions like ads, sidebars, popups, and clutter. Present content in a clean, high-contrast, customizable view.
3. **Eye Tracking**: Webcam-based gaze detection for hands-free reading and adaptive auto-scrolling.
4. **Auto Scroll**: Hands-free reading with adaptive, user-adjustable Words Per Minute (WPM) speed.
5. **Text to Speech (TTS)**: Web Speech API synthesis with real-time word highlighting and rate control.
6. **Word Highlight / Reading Line Ruler**: Guide focus line-by-line with a spotlight ruler following cursor movement or arrow keys.
7. **AI Summarizer**: Condense lengthy articles or dense web notices into key takeaways using structured AI endpoints.
8. **Accessibility Themes**: 5 themes (Default Light, Sepia Warmth, Dark Obsidian, High Contrast AAA, and Dyslexia-Friendly with OpenDyslexic font).

---

## Seven Cognitive Accessibility Modes

| Mode | Capability | Target Use Case |
|---|---|---|
| **Start Mode** | Wall of Awful Copilot & Task Initiation | Executive dysfunction freeze, breaking daunting tasks into 10-min action paths |
| **Simplify Mode** | Plain Language & Clutter Reduction | Converts dense notices or legal jargon into Grade 6.0 plain text |
| **Learn Mode** | Visual Mind Maps & Quiz Generator | Transforms academic papers and articles into hierarchical trees and self-quizzes |
| **Meet Mode** | Meeting Transcript Rescue | Extracts action items with owners and deadlines, and decodes corporate jargon |
| **Practice Mode** | Social Scripting Rehearsal | Rehearse difficult conversations, phone calls, or interview scenarios |
| **Write Mode** | Accessible Authoring Assistant | Checks passive voice, sentence complexity, and readability metrics |
| **Guide Mode** | In-Page Autonomous AI Navigator | Guides step-by-step through clumsy web forms (EPFO, banking, portals) |

---

## Quick Start & Local Run

### 1. Prerequisites
- Node.js (v18+)
- npm or pnpm

### 2. Backend Engine Setup
```bash
cd backend
npm install
cp .env.example .env     # Optional: Add GEMINI_API_KEY or OPENAI_API_KEY
npm start                # Express API running on http://localhost:3000
```

### 3. Web Dashboard (Frontend) Setup
```bash
cd frontend
npm install
npm start                # React dashboard running on http://localhost:3001
```

### 4. Chrome Extension Setup
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `chrome-extension` folder.
4. Click the **NeuroRead** extension icon on any webpage to use the 8 tools and 7 cognitive modes!

---

## Architecture & Compute Ladder (L0-L2)

```
L0  DETERMINISTIC OFFLINE   0 ms network · 100% Private · Zero API Keys Needed
    Bionic reading, Focus mode, Line ruler, Auto scroll, Local plain-language heuristics.

L1  ON-DEVICE MODEL         ~300 ms · Privacy Preserved
    Chrome Prompt API / Local LLM execution where supported.

L2  CLOUD AI ENGINES        ~1-2 s · Configurable API Server Endpoint
    Structured Gemini 1.5 / GPT-4o calls for deep synthesis and mind map generation.
```

---

## Verification & Audits

- **Zero Hardcoded Dependencies**: All backend endpoints are dynamically configurable.
- **Icon Design System**: Clean vector SVG icons replacing legacy emojis.
- **WCAG 2.1 AAA Compliance**: Contrast ratios >= 7:1 for text, 44px touch targets, and full keyboard navigation (Alt+B, Alt+F, Alt+E, Alt+S, Alt+T, Alt+H, Alt+A).
