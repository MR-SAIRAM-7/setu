# Chrome Web Store listing — SETU Lens

Everything the dashboard asks for, written out so a submission is copy-and-paste
rather than improvisation. Not shipped in the package.

---

## Before you submit

1. Confirm the URLs in [`shared/setu-config.js`](shared/setu-config.js) are the
   ones you want to ship. They currently point at
   `https://setu-37hl.onrender.com` (engine) and
   `https://setu-amber.vercel.app` (Sanctuary). `node build.js` fails the build
   if either is not `https`.
2. Confirm the engine allows `chrome-extension://` origins in CORS (the SETU
   backend does) and has an AI provider key configured — check
   `https://setu-37hl.onrender.com/api/health` reports `"aiConfigured": true`.
3. Bump `version` in `manifest.json`. The store rejects a re-upload of a version
   that already exists.
4. Run `node test/run.js`, then `node build.js`, and upload
   `dist/setu-lens-<version>.zip`.
5. Host `PRIVACY.md` at a public URL and paste that URL into the dashboard's
   privacy policy field — the store requires one for any extension with host
   permissions.

---

## Name

SETU Lens — Cognitive Accessibility

## Short description (132 characters max)

> Bionic text, line focus, spoken explanations in your own language, and an AI agent that reads any page and walks you through it, one step at a time.

(117 characters.)

## Category

Accessibility

## Language

English

---

## Detailed description

> **Websites are built for people who can hold a whole page in their head at once. Not everyone can.**
>
> SETU Lens reshapes any website in real time for how your brain actually reads — and when a page still feels like a wall, it asks an AI agent to break it into steps you can follow.
>
> **Reading tools that work everywhere, with no account and no server**
>
> • **Bionic Reading** — anchors the start of each word so your eye has something to land on
> • **Line Focus** — dims the page and lights the line you are on, snapping to real text, not a fixed band
> • **Reading Ruler** — a highlight that follows your cursor by line, word, or paragraph
> • **Focus Mode** — a clean reader view with the ads, popups and sidebars removed
> • **Explain This** — explains your selection, or what the page is about, in plain language and in your own language, then reads that explanation aloud in a natural voice. Ten Indian languages plus English. It can also just read the words verbatim if that is what you want.
> • **Map This** — turns a chart, table or dense section into a mind map, and clicking any node explains that node in your language, out loud
> • **Auto Scroll** — hands-free scrolling at your reading pace
> • **Gaze Scroll** — scrolls with your head position, using your webcam
> • **Reading themes** — sepia, calm, dark, high contrast, and a dyslexia-friendly setting with adjustable letter spacing and line height
>
> Turn on as many as you like. They are designed to work at the same time.
>
> **SETU Commander — an agent that reads the page you are actually on**
>
> Type or say what you want to do, and Commander reads the live page and answers, or builds a short plan and walks you through it, highlighting each control before you touch it.
>
> • "Summarise this page for me"
> • "Explain this in simple words" (works on your selection too)
> • "Find where I upload my documents"
> • Break any dense page into a 3-step path, with a list of what to have ready first
> • Ask it to explain a chart, table or diagram in plain language
>
> **Built to be safe on real websites**
>
> Commander runs on banking and government portals, so it is deliberately cautious:
>
> • It can only act on controls it can actually see on the page
> • Anything irreversible — submit, pay, send, delete — stops and waits for you to confirm. Auto-run will not do it for you.
> • It never invents personal details. If a form needs your information, it hands control back to you.
> • Password fields are never included in what is sent to the AI.
>
> **Your engine, your keys**
>
> The AI features connect to a SETU engine that you run and configure — your own machine, or your own deployment. SETU Lens has no servers of its own, no analytics, and no advertising. The reading tools work entirely offline.
>
> Keyboard shortcuts throughout: Alt+B bionic, Alt+F focus mode, Alt+L line focus, Alt+T Explain This, Alt+Shift+C the Commander, Alt+X to turn everything off.

---

## Permission justifications

The dashboard asks for one per permission. These are the answers.

**`activeTab` and host permission for all sites**
> The reading tools work by restyling the page the user is currently reading — bionic text, line focus, reader view, themes. Users choose which site to use them on, and an accessibility accommodation that only worked on a pre-approved list of sites would not be an accommodation. Nothing is read or transmitted from a page unless the user activates a feature on it.

**`scripting`**
> Content scripts are not retroactive. Without programmatic injection, every tab that was already open when the extension was installed or updated would appear completely non-functional until the user reloaded it by hand. This is used only to inject the extension's own bundled content scripts, never remote code.

**`storage`**
> Stores the user's reading preferences (bionic strength, letter spacing, line height, speech rate, theme), which tools they left switched on, and their configured engine URL.

**`tabs`**
> Finds the active tab in order to deliver a command from the toolbar popup, the context menu, or a keyboard shortcut, and captures the visible tab so the user can ask for a plain-language description of a chart they point at.

**`contextMenus`**
> Adds the right-click entries "Explain this in plain language", "Read this aloud", and "Send page to my Sanctuary", which are the primary entry point for users who find toolbar menus hard to navigate.

**Remote code**
> None. Every script is bundled in the package. The extension makes network requests only to the engine URL the user configures, and only to that engine's JSON API.

---

## Data-use disclosures

| Question | Answer |
| --- | --- |
| Personally identifiable information | Not collected |
| Health information | Not collected |
| Financial and payment information | Not collected |
| Authentication information | Not collected (password fields are explicitly excluded) |
| Personal communications | Not collected |
| Location | Not collected |
| Web history | Not collected |
| User activity | Not collected |
| Website content | **Collected** — page text and, for chart descriptions, a crop of a user-selected element are sent to the user's own configured engine, only when the user invokes an AI feature |

Certifications to tick:

- [x] I do not sell or transfer user data to third parties, apart from the approved use cases
- [x] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Single purpose statement**
> SETU Lens makes web pages readable and navigable for people with ADHD, dyslexia, autism, or memory difficulties, by restyling the page for legibility and by explaining or breaking down what is on it.

---

## Store assets to prepare

| Asset | Size | Notes |
| --- | --- | --- |
| Store icon | 128×128 | `icons/icon128.png` |
| Screenshots | 1280×800 | At least one, up to five |
| Small promo tile | 440×280 | Optional but improves placement |
| Marquee promo tile | 1400×560 | Optional |

Suggested screenshots, in order:

1. An article with Bionic Reading and Line Focus both on — the composability is the differentiator
2. The Commander mid-plan, ring drawn around the highlighted control
3. Focus Mode reader view next to the original cluttered page
4. The 3-step path panel on a dense government form
5. The popup, showing the tool grid and the green engine pill

---

## Review notes for the store team

> The AI features talk to a backend ("the SETU engine") that ships pre-configured
> at `https://setu-37hl.onrender.com`, so they work immediately on install with
> no setup. Users may point the extension at their own deployment on the options
> page instead.
>
> That engine is hosted on a free tier and sleeps when idle, so the first request
> after a period of inactivity takes up to a minute while the service wakes. The
> extension shows this as "waking up" rather than an error. If a review step
> appears to hang, this is why — the second request will be fast.
>
> Without any engine the extension still installs and the entire reading toolkit
> works; the AI panels report that the engine is unreachable and offer the
> options page.
>
> The webcam permission (Gaze Scroll) is optional, off by default, and prompts
> through the standard browser dialog. Frames are sampled in memory to estimate
> head position for hands-free scrolling and discarded immediately; no video is
> stored or transmitted.
>
> Note for review: the camera is opened by an extension page loaded in a frame
> (camera/frame.html), never by the host site. That is why the permission is
> requested once for the extension rather than repeatedly for each site the
> reader visits, and it means no website obtains camera access through this
> extension. Only a single head-offset number crosses back into the page.
