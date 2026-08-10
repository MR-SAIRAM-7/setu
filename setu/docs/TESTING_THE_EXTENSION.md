# Testing SETU Lens in your own browser

Ten minutes, no keys, no database, no account. Everything in §1–§4 works with the network
disconnected. §5 onwards is only for the cloud rungs.

---

## 1. Build it

```bash
pnpm install
pnpm ext:build          # → apps/extension/dist
```

The last line of a successful build tells you where it went:

```
✓ SETU Lens built to apps/extension/dist
```

If you want it to rebuild every time you save a file, use `pnpm --filter @setu/extension dev`
instead. Chrome does **not** pick up a rebuild on its own — see §7.

> On Windows, if `pnpm` is not recognised, run `corepack pnpm run ext:build`. The root scripts
> re-invoke through `npm_execpath` rather than assuming a `pnpm` binary on PATH.

---

## 2. Load it

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the **`apps/extension/dist`** folder — not `apps/extension`, not the repo root

You should now see **SETU Lens — the cognitive bridge, 1.0.0**.

On first install it opens the **onboarding page** in a new tab. It takes under a minute and
everything downstream reads from it, so do it once rather than skipping it. You can reopen it any
time from the extension's **Details → Extension options**.

Two things worth copying off `chrome://extensions` while you are there:

- the **extension ID** (a 32-letter string) — you need it in §6
- the **Service worker** link — that is the background console, see §8

---

## 3. The one thing that trips everyone up

**Nothing happens on a page until you click the SETU icon on that page.**

There is deliberately no `content_scripts` block in the manifest. A static `<all_urls>` entry would
trigger Chrome's *"read and change all your data on all websites"* install warning, which would
undercut the entire privacy claim. So the content script is injected on demand, via `activeTab`,
the moment you explicitly ask for it.

In practice:

1. Open a real page — a news article, a government form, a documentation site
2. Click the **SETU icon** in the toolbar (pin it first: puzzle-piece → pin)

That single click does two things: injects `content.css` + `content.js` into the page, and opens
the side panel.

**It cannot run on:** `chrome://` pages, `chrome-extension://` pages, the Chrome Web Store,
`about:blank`, the built-in PDF viewer, or a local `file://` page unless you tick *Allow access to
file URLs* on the extension's Details screen. That is a Chrome restriction, not a SETU bug — the
service worker logs `[SETU] cannot inject here:` when it happens.

To make SETU load automatically on a site you use often, open the panel there and use the
**"Let SETU be ready on <site>"** prompt at the bottom of the **Page** tab. That grants a host
permission for that one origin and registers the script persistently for it.

---

## 4. What to actually try (all offline, all L0)

Open the panel on a busy page and work down the **Page** tab.

| Try this | What should happen |
|---|---|
| Look at the top of the **Page** tab | A Cognitive Load Score out of 100 with a band name in words, plus its six components. Computed locally in ~40 ms, no network call. |
| **Alt+Shift+F** (or *Make this page survivable*) | Focus mode: ads, banners, tickers, sticky bars and side rails collapse; the score is re-measured and drops. Press it again — the page comes back with no residue. |
| **Alt+Shift+Q** | Panic: everything collapses to one card with one action. **Escape** returns the page. |
| Turn on **Bionic anchors** | Word-initial anchors appear across the page's real text. Off by default, so nothing changes until you ask. |
| Turn on the **Line guide** | A reading ruler follows the pointer without ever intercepting a click. |
| Sit still on a hostile page | If the score is in the busy band or above, SETU offers a pause. It talks about the *page*, never about you. Dismissing it is one click and it does not come back. |
| **Alt+Shift+D** | Demo mode: a `DEMO` badge on the icon, local fixtures, no network. This is the switch to rehearse with wifi off. |
| The **Trust** tab | Every run listed — when, which mode, which rung, which provider, bytes off-device, details redacted. L0 and L1 runs are logged too, which is what makes it a proof rather than a list of accusations. |

Two things are worth checking deliberately, because they are the promises that matter most:

- **Focus mode never hides a form control.** Turn it on over a page with a login form, a search box
  or a checkout — inputs, selects, textareas, buttons and labels stay. This is asserted by the
  automated content-script suite too (§9).
- **The agent cannot see a password.** Open the **Do it** tab on a page with a password or OTP
  field; those controls are withheld from the plan the model ever sees.

If nothing at all seems to happen after clicking the icon: bionic and the line guide are **off** by
default, and the load meter lives in the side panel rather than on the page. That is correct
behaviour, not a broken build. The visible-on-page features are focus mode, panic, the pause offer,
bionic and the line guide.

---

## 5. Optional: run Sanctuary too, for the cloud rungs

L0 needs nothing. Anything that reaches a model needs the API to be running, and the extension
ships pointing at `http://localhost:3000` (that origin is in `host_permissions`).

```bash
pnpm --filter @setu/web dev     # must be port 3000
```

Check what it can do:

```bash
curl -s http://localhost:3000/api/health
```

With an empty `.env.local`, `cloudAI` is `false` — and the mode screens say so *before* you press
the button rather than after. There is no consent dialog for a call that cannot happen. Add a key
to change that:

```bash
echo 'GOOGLE_GENERATIVE_AI_API_KEY=...' >> .env.local
```

To point the extension somewhere else, build it with the base URL baked in:

```bash
VITE_SETU_API_BASE=https://your-deployment pnpm ext:build
```

---

## 6. Optional: the extension ID allowlist

In development you do not need this. `apps/web/src/server/cors.ts` permits any
`chrome-extension://` origin when `NODE_ENV !== 'production'`, because the ID changes every time
you reload unpacked and hard-coding it would mean editing an env var twenty times a day.

Against a **production** build or a deployed Sanctuary, an unlisted origin gets no CORS header at
all and every call from the panel fails. Copy the ID from `chrome://extensions` and set:

```bash
SETU_ALLOWED_EXTENSION_IDS=abcdefghijklmnopabcdefghijklmnop
```

Never set it to `*`. CI fails the build if a wildcard CORS origin appears anywhere in the source.

---

## 7. After you change code

```bash
pnpm ext:build
```

then on `chrome://extensions` click the **↻ reload** icon on the SETU card, **and reload the page
you were testing on**. Both. The service worker picks up the new build on reload, but the old
content script is still living in the old page until that page is reloaded, and a mismatch between
the two produces confusing "the message went nowhere" behaviour.

If the side panel looks stale, close and reopen it — it is a separate document with its own
lifetime.

---

## 8. Where each console lives

Three separate JavaScript contexts, three separate consoles. Looking in the wrong one is the most
common reason "there's no error" and "it doesn't work" are both true at once.

| What you are debugging | Where to look |
|---|---|
| Service worker: routing, tiering, ledger, injection failures | `chrome://extensions` → SETU → **Service worker** |
| Content script: focus mode, the load meter, the pause offer | The **page's own** DevTools console (F12 on the page) |
| Side panel UI | Right-click inside the panel → **Inspect** |
| Options / onboarding | F12 on the options tab |

The service worker sleeps when idle — that is normal MV3 behaviour, not a crash. Clicking the icon
wakes it.

---

## 9. The automated version

Before you go clicking, or after you change the content script, this drives the **built**
`content.js` against a deliberately hostile page in real Chromium — 14 checks, including that focus
mode never hides a form control and that a password field never reaches the planner:

```bash
pnpm --filter @setu/extension test
```

It skips gracefully with a message if Chromium is not installed
(`pnpm --filter @setu/extension exec playwright install chromium`), and honours `SETU_CHROMIUM` if
you want to point it at a browser you already have.

The rest of the suite, for context:

```bash
pnpm verify                          # typecheck + tests + build, all workspaces
pnpm --filter @setu/core test        # 46 kernel tests
pnpm --filter @setu/ui contrast      # 124 contrast assertions across 4 themes
pnpm --filter @setu/web a11y         # axe-core over 19 routes × light and dark
```

---

## 10. Packaging

```bash
pnpm ext:zip     # → setu-lens.zip
```

That is the store submission. For a demo, load `apps/extension/dist` unpacked — never depend on a
store listing on demo day.

---

## Troubleshooting

**The icon is greyed out / clicking does nothing.** You are on a page Chrome will not let any
extension touch — `chrome://`, the Web Store, `about:blank`, or the PDF viewer. Open a normal
http(s) page.

**"Could not establish connection. Receiving end does not exist."** The page was loaded before the
content script existed, or you rebuilt without reloading the page. Reload the page and click the
icon again.

**The panel opens but every AI action fails.** Sanctuary is not running on port 3000, or it is
running as a production build with your extension ID missing from `SETU_ALLOWED_EXTENSION_IDS`
(§6). Check `/api/health` first — it reports capability, never configuration.

**Keyboard shortcuts do nothing.** Another extension has claimed them. Reassign at
`chrome://extensions/shortcuts`.

**Focus mode hid something it should not have.** That is a real bug and worth reporting with the
URL — the selector list in `packages/core/src/transform/sanitize.ts` is anchored deliberately so
that `download-area`, `read-more`, `thread-list` and friends survive, and the kernel suite asserts
it.

**Fonts look wrong in the panel.** The typefaces are self-hosted and bundled; a missing font means
an incomplete build. Re-run `pnpm ext:build` and check `dist/assets` contains the `.woff2` files.
