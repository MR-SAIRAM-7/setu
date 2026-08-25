# SETU Sanctuary — Web Requirements & Production Setup Guide

This guide contains the manual setup steps and configuration details required to make the SETU Sanctuary Web Application and API fully functional in production.

---

## 1. Overview of Upgraded Architecture

| Component | Technology | Description |
| :--- | :--- | :--- |
| **AI Engine** | **Google Gemini** | Two model chains. Fast (`gemini-3.7-flash` → `3.6-flash` → `3.5-flash` → `3.5-flash-lite` → `2.5-flash` → `2.5-flash-lite`) serves every request a human is waiting on; Deep (`gemini-3.1-pro-preview` → `2.5-pro`) serves research and mind-map structuring. Steps down the chain on rate limit (429), 404, or provider downtime, and prunes unreachable IDs at boot. |
| **Optional fallback** | **OpenAI** | Unset in most deployments. Degrades to the offline deterministic L0 rule engine when no key is reachable. |
| **Database Persistence** | **MongoDB (Mongoose)** | Stores user conversations, message threads, uploaded document text & summaries, interactive mind maps, and accessibility settings. |
| **File Processing** | **Multer + PDF-Parse + Mammoth** | Accepts PDF, Word (.docx), Markdown, TXT, CSV, JSON, and Images up to 25MB with instant OCR / text extraction, auto-summarization, and grounded Q&A. |
| **Mind Map Visual Export** | **jsPDF + html2canvas + SVG** | Generates Broadsheet-styled visual PDF documents, 2.5× retina PNG images, standalone SVG vectors, Markdown, and JSON. |
| **Frontend Web App** | **React 18 + Vite + Tailwind CSS** | Clean accessible broadsheet interface tailored for ADHD, dyslexia, and neurodivergent cognition. |

---

## 2. Manual Action Items (Required from your side)

To make the application fully operational, please complete the following manual steps:

### Step 1: Obtain a Google Gemini API Key
1. Visit **[Google AI Studio](https://aistudio.google.com/apikey)** and sign in with your Google account.
2. Click **Create API key** and pick (or create) a Google Cloud project.
3. Copy the generated key into `GEMINI_API_KEY`.
4. The free tier is enough to run and demo SETU. For production throughput and no daily cap, enable **Cloud Billing** on that project.

> **A Google AI Pro / Google One AI Premium subscription is not API access.** Those are consumer
> plans for the Gemini app. The API key above is separate, and is what SETU uses.

### Step 2: Set Up MongoDB Database (Local or Cloud Atlas)

You have two options for your MongoDB persistence:

#### Option A: Free Cloud MongoDB Atlas (Recommended for Production)
1. Sign up at **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)**.
2. Create a free **M0 Sandbox** cluster (AWS or GCP region near your users).
3. Under **Security → Database Access**, create a database user (e.g., `setu_user`) with password authentication.
4. Under **Security → Network Access**, add an IP Access List entry: `0.0.0.0/0` (Allow Access from Anywhere).
5. Click **Clusters → Connect → Drivers (Node.js)** to get your connection URI:
   ```
   mongodb+srv://setu_user:<PASSWORD>@cluster0.abcde.mongodb.net/setu?retryWrites=true&w=majority
   ```
6. Replace `<PASSWORD>` with your database user password.

#### Option B: Local MongoDB
If running locally on your computer:
1. Install MongoDB Community Server: **[MongoDB Downloads](https://www.mongodb.com/try/download/community)**.
2. Start the local MongoDB service:
   ```powershell
   # Windows command
   net start MongoDB
   ```
3. Use the local connection string:
   ```
   mongodb://127.0.0.1:27017/setu
   ```

---

### Step 3: Configure Environment Variables

Create or update `.env` in the project root (`D:\PROJECTS\setu\.env`) and inside `backend/` (`D:\PROJECTS\setu\backend\.env`):

```env
# ==============================================================================
# SETU Sanctuary — Environment Configuration
# ==============================================================================

# --- 1. AI Engine (Google Gemini) ---
GEMINI_API_KEY=your-gemini-api-key-here

# Leave GEMINI_MODEL blank to use the top of the chain.
GEMINI_MODEL=
GEMINI_MODEL_CHAIN=gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite
GEMINI_PRO_MODEL_CHAIN=gemini-3.1-pro-preview,gemini-2.5-pro
GEMINI_THINKING_LEVEL=low
GEMINI_PRO_THINKING_LEVEL=high
GEMINI_WEB_SEARCH=true
GEMINI_DISCOVER_MODELS=true

# --- 2. Optional last-resort fallback ---
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# --- 3. MongoDB Database Persistence ---
MONGODB_URI=mongodb+srv://setu_user:yourpassword@cluster0.abcde.mongodb.net/setu?retryWrites=true&w=majority

# --- 4. Engine Server Settings ---
PORT=3000
NODE_ENV=development
AI_TIMEOUT_MS=45000
AI_DEADLINE_MS=90000
AI_MAX_RETRIES=2
AI_MAX_RETRY_WAIT_MS=8000

# --- 5. Web App (Production Only) ---
# Leave blank in development (Vite proxies /api to PORT 3000 automatically)
VITE_API_URL=
```

---

## 3. Environment Variables Reference Table

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Required** | `null` | Gemini API key. Create one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | Optional | top of chain | Preferred model. Retired IDs (`gemini-1.5-*`, `gemini-2.0-*`) are rejected with a warning. |
| `GEMINI_MODEL_CHAIN` | Optional | Flash chain | Comma-separated fallbacks, tried in order when a model 429s, 404s, or times out. |
| `GEMINI_PRO_MODEL_CHAIN` | Optional | Pro chain | Models for research and map structuring. Falls through to the Flash chain. |
| `GEMINI_THINKING_LEVEL` | Optional | `low` | Reasoning depth on the fast chain: `minimal`, `low`, `medium`, `high`. |
| `GEMINI_WEB_SEARCH` | Optional | `true` | Google Search grounding on the research pass. Costs quota per grounded call. |
| `GEMINI_DISCOVER_MODELS` | Optional | `true` | Ask the API at boot which models this key can reach, and skip the rest. |
| `MONGODB_URI` | **Recommended** | `mongodb://127.0.0.1:27017/setu` | MongoDB database connection string (local or MongoDB Atlas). |
| `OPENAI_API_KEY` | Optional | `null` | OpenAI key, used only if every Gemini model is unreachable. |
| `PORT` | Optional | `3000` | Port for Express backend server. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development`, `production`, `test`). |
| `AI_TIMEOUT_MS` | Optional | `45000` | Ceiling on a single HTTP call to a model. |
| `AI_DEADLINE_MS` | Optional | `90000` | Ceiling on one logical request — chain walk and retries included. This is the wait a user actually experiences. |
| `AI_MAX_RETRIES` | Optional | `2` | Retry attempts per provider, with exponential backoff. |
| `VITE_API_URL` | Production | `""` | Backend API base URL when hosted on a different domain. |

---

## 4. How to Run and Verify

### 1. Start the Backend Server
```powershell
cd D:\PROJECTS\setu\backend
npm start
```
You should see:
```text
  SETU API Server → http://localhost:3000
  Database        : MongoDB (Connected)
  AI Engine       : Google Gemini — gemini-3.7-flash (+5 in the fallback chain)
  Deep chain      : gemini-3.1-pro-preview
  Health Check    : http://localhost:3000/api/health
```

### 2. Start the Frontend Web App
```powershell
cd D:\PROJECTS\setu\frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 3. Run Automated Production Smoke Test
In a separate terminal:
```powershell
cd D:\PROJECTS\setu\backend
npm run smoke
```
This automatically verifies:
- AI health probe round-trip
- MongoDB persistence
- File upload and document extraction
- Chat SSE streaming
- Mind Map generation & node expansion
- All 7 Cognitive Modes (Start, Simplify, Learn, Meet, Practice, Write, Guide)
- Safety gating on browser agent actions

---

## 5. Summary of New Features Available

1. **Google Gemini with Automatic Fallback**:
   - Seamlessly switches to the next model in the chain on quota, 404, or provider errors, and prunes IDs the key cannot reach at boot.
2. **Database Persistence**:
   - Saves conversations, message history, uploaded documents, mind maps, and user preferences directly to MongoDB.
3. **File Upload & Document Processing**:
   - In the Mind Map page or Library, click **Upload** to attach PDFs, Word files, text notes, or images.
   - The AI summarizes the document, extracts key takeaways, allows you to **generate an interactive mind map from the file**, or **chat directly with the document**.
4. **Visual Mind Map Exports**:
   - Export your mind maps as:
     - **Broadsheet Visual PDF**: Clean multi-page document with summary, key takeaways, indented tree table, and citations.
     - **High-Resolution PNG**: 2.5× retina image.
     - **Vector SVG**: Scalable vector graphics.
     - **Markdown / JSON**: Data outlines.
5. **Cognitive Modes File Ingestion**:
   - In the **Modes** screen, click **"Upload file instead"** to load document text directly into any cognitive tool (Simplify, Learn/Quiz, Meet, Guide, Start, Write).
