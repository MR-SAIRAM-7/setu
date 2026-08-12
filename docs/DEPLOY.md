# Deploying NeuroRead

A deployment with no environment variables at all is a complete, working product — the whole UI, the whole L0 offline rung, the Vault, the Trust Ledger, and a real deterministic result for every one of the modes. Configuration adds capability; its absence never removes correctness.

Check what a running deployment can actually do:

```bash
curl https://your-deployment/api/health
```

```json
{
  "status": "healthy",
  "product": "NeuroRead",
  "engine": "SETU Kernel Modular v2.5",
  "aiEnabled": true,
  "modes": ["start", "simplify", "learn", "meet", "practice", "write", "guide", "agent_navigate"]
}
```

---

## 1. Backend API Deployment

The backend is an Express Node.js application.

```bash
cd backend
npm install
npm start
```

### Environment Variables (.env)

| Variable | Description |
|---|---|
| `PORT` | Server listening port (default: 3000) |
| `GEMINI_API_KEY` | Google Gemini Flash 1.5 API Key |
| `OPENAI_API_KEY` | OpenAI API Key (GPT-4o / GPT-3.5) |

---

## 2. Frontend Web Dashboard Deployment

The frontend is a React application built with standard ES modules.

```bash
cd frontend
npm install
npm run build
```

Set `REACT_APP_API_URL` to point to your live Express backend.

---

## 3. Chrome Extension Packaging

1. Build the extension resources.
2. In Chrome, go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `chrome-extension` directory.
5. In the extension popup or settings, set the API server URL to your backend endpoint.
