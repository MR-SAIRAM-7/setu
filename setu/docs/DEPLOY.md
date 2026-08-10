# Deploying SETU

Everything below is optional except the first section. A SETU deployment with no environment
variables at all is a complete, working product — the whole UI, the whole L0 rung, the Vault, the
Trust Ledger, and a real deterministic result for every one of the nine modes. Configuration adds
capability; its absence never removes correctness.

Check what a running deployment can actually do:

```bash
curl https://your-deployment/api/health
```

```jsonc
{
  "ok": true,
  "deterministic": true,   // always
  "cloudAI": false,        // needs GOOGLE_GENERATIVE_AI_API_KEY
  "database": false,       // needs Supabase
  "shareLinks": false,     // needs the service-role key
  "barrierLedger": false   // needs the service-role key + SETU_BARRIER_SALT
}
```

---

## 1. Sanctuary → Vercel

The repo is a pnpm workspace, so Vercel needs to build from the root and the project root has to be
`apps/web`. `apps/web/vercel.json` already carries that, plus function durations and the security
headers.

```bash
pnpm dlx vercel link          # choose apps/web as the project root
pnpm dlx vercel --prod
```

**Project settings**

| Setting | Value |
|---|---|
| Root directory | `apps/web` |
| Framework | Next.js (detected) |
| Build command | from `vercel.json` — do not override |
| Node version | 22.x |
| Region | `bom1` for an Indian audience |

**Nothing else is required to get a live, working deployment.** The landing page, the whole
Sanctuary UI, every deterministic mode, the Vault and the Trust Ledger all work at this point.

---

## 2. Cloud AI (optional)

```bash
pnpm dlx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
pnpm dlx vercel env add GROQ_API_KEY production          # optional fallback rung
```

⚠️ **Verify the model IDs against the provider on day one.** A wrong model ID is a 404 that looks
like a bug in your own code for twenty confusing minutes. Override with `SETU_MODEL_FLASH`,
`SETU_MODEL_FLASH_LITE`, `SETU_MODEL_PRO`.

Turn on the provider's "do not use my data for training" setting and be ready to name it — the
zero-retention claim on `/privacy` depends on it.

Without a key, `/api/health` reports `cloudAI: false`, and the mode screens say so *before* the
button is pressed rather than after. There is no consent dialog for a call that cannot happen: a
dialog asking permission to reach a model that is not configured would teach people to click
through consent dialogs, which is the one habit this product must not teach.

---

## 3. Supabase (optional)

Adds caregiver share links and the anonymous barrier ledger.

⚠️ **Not cross-device sync.** The schema and RLS are ready for an account, but there is no
sign-in UI yet, so the ledger mirror and DNA sync have nothing to attach to. `/api/ledger`
correctly reports `persisted: 0` and says why rather than pretending. Everything else on this
page works.

```bash
supabase link --project-ref <ref>
supabase db push
supabase db lint      # run it. it will find something.
```

Then:

```bash
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm dlx vercel env add SETU_BARRIER_SALT production      # openssl rand -hex 32
```

**Checklist before you call it done**

- [ ] RLS on for every table — `0001_init.sql` does this; confirm in the dashboard
- [ ] `pgvector` present and the HNSW index created
- [ ] `barrier_signals` has RLS **on** and **no policies** — that is deliberate, and it is why only
      the service role can insert
- [ ] `match_vault` is `security invoker`, so RLS applies inside the function
- [ ] the service-role key is set as a **server** variable, never as `NEXT_PUBLIC_*`
- [ ] daily backups on

**Do not rotate `SETU_BARRIER_SALT`.** It salts the one-way path hash; rotating it orphans every
existing row.

---

## 4. Lens → Chrome

```bash
VITE_SETU_API_BASE=https://your-deployment pnpm ext:build
```

Then `chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist`.

**This is what you demo.** Never depend on a store listing on demo day. Testing it locally, in
your own browser, has its own page: [`TESTING_THE_EXTENSION.md`](TESTING_THE_EXTENSION.md).

Copy the extension ID from that page and add it to the API allowlist:

```bash
pnpm dlx vercel env add SETU_ALLOWED_EXTENSION_IDS production
```

⚠️ **Never set that to `*`.** It would make the API usable by any page on the internet, and CI has
an assertion that fails the build if a wildcard CORS origin appears anywhere in the source.

For the store:

```bash
pnpm ext:zip     # → setu-lens.zip
```

Justify every permission in the listing. Reviewers reject vague justifications, and writing them
forces a check that nothing is over-requested. SETU asks for `activeTab` plus optional host
permissions granted per site — not `<all_urls>` at install — and both the reviewer and any judge
who looks will notice the difference.

---

## 5. Verify the deployment

```bash
pnpm verify                        # typecheck + kernel tests + build
pnpm --filter @setu/ui contrast    # 124 contrast assertions, 4 themes
pnpm --filter @setu/web a11y       # axe-core, 19 routes × light and dark
pnpm eval                          # the golden set (needs a provider key)
```

Then, against the live URL:

```bash
curl -s https://your-deployment/api/health | jq
```

---

## 6. Pre-demo checklist

Print this.

```
[ ] Extension loads unpacked with no console errors on five real sites
[ ] Sanctuary production URL loads in under 2 s
[ ] Demo profile set up on the demo laptop AND the backup laptop
[ ] Demo mode (Settings → Demo mode) verified with the network disabled
[ ] The wifi-off segment rehearsed: focus mode, bionic, load score, panic button
[ ] Cache pre-warmed for every demo input
[ ] Backup video on a USB stick, on a phone, and in the cloud
[ ] Mobile hotspot charged and tested
[ ] Two HDMI / USB-C adapters
[ ] Browser: bookmarks bar cleared, one window, no personal tabs, notifications OFF
[ ] Zoom at 110–125% so the back of the room can read it
[ ] Laptop on mains power, sleep disabled, Do Not Disturb ON
[ ] Screen recording software OFF — it steals frames
```

---

## Troubleshooting

**`pnpm` is not recognised on Windows.** Root scripts go through
`scripts/workspace.mjs`, which re-invokes through `npm_execpath` rather than assuming a `pnpm`
binary on PATH. If a script still fails, run it as `corepack pnpm run <script>`.

**PDF upload does nothing.** The worker is copied to `public/pdf.worker.min.mjs` by the `prebuild`
script. If it is missing, run `node apps/web/scripts/copy-pdf-worker.mjs`. PDF parsing happens in
the browser on purpose — the file never leaves the user's machine, which is both the better privacy
story and one less serverless bundle to fight.

**Chunk 404s after a rebuild.** A previous `next start` is still running and serving the old
build's HTML. Kill it (`pkill -f next-server`) and restart.

**"No AI engine is configured" on a deployment that has a key.** The key is set for the wrong
environment, or the deploy predates it. Check `/api/health` — it reports capability, never
configuration, so it is safe to look at in public.
