# SETU Lens — Privacy Policy

_Last updated: 29 August 2026_

SETU Lens is an accessibility extension for people with ADHD, dyslexia, autism,
or memory difficulties. This document states exactly what it reads, what it
sends, and where it sends it.

**SETU Lens has no analytics, advertising, or tracking of any kind, and no
collection endpoint.** It talks only to two services, both of which you can
change or replace on its options page:

- the **SETU engine**, by default `https://setu-37hl.onrender.com`, which
  handles the AI features;
- the **SETU Sanctuary** web app, by default `https://setu-amber.vercel.app`,
  which only ever receives a page you explicitly send to it.

You can point either at your own deployment, or at a backend running on your own
machine, and nothing else about the extension changes.

---

## What runs entirely on your device

These features never send anything anywhere. They read and restyle the page in
your browser and stop there.

- Bionic Reading
- Focus Mode (reader view)
- Line Focus and the Reading Ruler
- Reading themes
- Auto Scroll
- Explain This, when it falls back to the browser's built-in voices
- The Breathe Protocol's overwhelm detection

---

## What is sent, and only when you ask for it

Each of the following happens **only in response to a deliberate action** — a
click, a menu choice, or a typed request. Nothing is sent in the background, and
nothing is sent on pages where you have not invoked an AI feature.

| You do this | What is sent | Where it goes |
| --- | --- | --- |
| Press play in Explain This, or choose "Explain this out loud" | The text you selected, or up to 6,000 characters of the page's main text if you selected nothing, plus your chosen language | Your configured SETU engine |
| Have Explain This speak with the natural voice | The sentences of the explanation, one clip at a time, so they can be turned into audio. With no engine configured, your browser's own voice is used and nothing is sent | Your configured SETU engine |
| Ask the Commander to do something | Your typed or spoken request, the page title and URL, its headings, up to 3,000 characters of visible text, and a list of the visible interactive controls with their labels | Your configured SETU engine |
| Ask the Commander a question, or press Summarise | Your question plus your current selection, or up to 6,000 characters of the page's main text | Your configured SETU engine |
| Request the 3-step path | Page title, URL, headings, form field labels, and up to 4,000 characters of text | Your configured SETU engine |
| Click a node on a mind map to have it explained | That node's label and detail line, the map's title, and your chosen language | Your configured SETU engine |
| Explain a chart or image, or change a mind map's language | A cropped screenshot of the element you picked, or its text if it is text-based, plus the page title and your chosen language | Your configured SETU engine |
| Send page to my Sanctuary | The page title, URL and readable text | Your configured Sanctuary web app |

The SETU engine then forwards the request to whichever AI provider it is
configured with (Google Gemini, or OpenAI if a key for it is set). Their handling of that
data is governed by their own privacy policies. If you point the extension at an
engine you run yourself, you choose the provider and hold the API key.

Requests are not logged against you. The engine receives a random install
identifier (below) for rate limiting and nothing else that identifies you.

### What is deliberately excluded

- **Password fields.** The contents of any `type="password"` input are never
  included in the page description sent to the model.
- **Hidden fields** and controls that are not visible on screen.
- **Whole-page screenshots.** Image description crops to the single element you
  picked before sending.

---

## Camera

Gaze Scroll uses your webcam to estimate head position so the page can scroll
hands-free. It is off by default and requires an explicit browser permission
prompt.

The camera is opened by a page belonging to the extension itself, not by the
website you are reading. That means the permission you grant is granted to SETU
once, rather than to each individual site, and no website ever gains camera
access through SETU. You can review or withdraw it from the camera icon in the
address bar, or from Chrome's site settings for the extension.

Frames are drawn into an in-memory canvas, reduced to an 80×60 sample, measured
for skin-tone density, and discarded. **No video, image, or frame is stored,
saved, or transmitted anywhere**, including to your own engine — the only thing
that leaves that page is a single number describing how far your head has moved
from its resting position. Turning the feature off stops the camera track
immediately.

## Microphone

The Commander's voice input uses the browser's built-in speech recognition,
started only when you click the microphone button. Audio handling is the
browser's; SETU Lens receives only the resulting text.

---

## What is stored

In Chrome's extension storage on your device (synced across your Chrome profile
if you have Chrome Sync enabled):

- Which reading tools are on, your chosen theme, and your reading preferences
- Your engine and Sanctuary URLs
- A random install identifier, e.g. `setu_9f2c…`

The install identifier is sent with engine requests so the engine's rate limiter
can tell one installation from another — without it, everyone behind a shared
network address competes for a single quota. It is generated randomly on your
device, is not derived from anything about you or your hardware, and is not
linked to any account or profile. Resetting settings on the options page or
reinstalling the extension replaces it.

Page content captured by "Send page to my Sanctuary" is kept in local extension
storage, capped at the 25 most recent captures, and never leaves your device
except to the Sanctuary URL you configured.

**No browsing history is collected.** SETU Lens does not record which sites you
visit, does not build a profile, and does not send anything about a page you did
not act on.

---

## Permissions, and why each is needed

| Permission | Why |
| --- | --- |
| `activeTab`, and host access to `http://*/*` and `https://*/*` | The reading tools work by restyling whatever page you are on, so they must be able to run on any site you choose to use them on. This is also what lets SETU find the active tab to send it a command, and capture the visible tab for chart descriptions. |
| `scripting` | Injects the reading tools into tabs that were already open when the extension was installed or updated, so you do not have to reload them. |
| `storage` | Remembers your settings and which tools you left on. |
| `contextMenus` | Adds the right-click "Explain this", "Turn this into a mind map" and related entries. |
| `alarms` | Wakes the AI engine every ten minutes while your browser is open, so your first request does not have to wait for it to start up. It sends no page data — only an empty health check. |

The broad `tabs` permission is deliberately **not** requested: everything SETU
needs from a tab is already covered by the host access above, which is limited
to ordinary web pages.

Camera access is not listed in the manifest at all. It is requested by the
browser at the moment you first turn Gaze Scroll on, and only then.

---

## Data sale and transfer

SETU Lens does not sell data, does not transfer data to third parties for any
purpose unrelated to the feature you invoked, and does not use data for
creditworthiness or lending. It contains no advertising or analytics SDKs.

## Children

SETU Lens is a general-purpose accessibility tool and does not knowingly collect
personal information from anyone, including children.

## Changes

Material changes to this policy will be published with a new extension version
and a revised date at the top of this file.

## Contact

Questions about this policy, or a request about data held by an engine you do
not control, should go to whoever operates that engine. For the extension
itself, open an issue on the SETU repository.
