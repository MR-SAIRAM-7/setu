# SETU Sanctuary — Web Requirements & Production Setup Guide

This guide contains the manual setup steps and configuration details required to make the SETU Sanctuary Web Application and API fully functional in production.

---

## 1. Overview of Upgraded Architecture

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Primary AI Engine** | **OpenRouter AI** | Primary intelligent agent with automated multi-model fallback chain (`google/gemini-2.5-flash`, `claude-3.5-haiku`, `llama-3.3-70b`, `deepseek-chat`, `gpt-4o-mini`). Automatically steps down the chain on rate limit (429), balance limit (402), or provider downtime. |
| **Secondary / Tertiary AI** | **Gemini & OpenAI** | Direct provider fallbacks if OpenRouter is unreachable. Degrades gracefully to offline deterministic L0 rule engine if all keys are unavailable. |
| **Database Persistence** | **MongoDB (Mongoose)** | Stores user conversations, message threads, uploaded document text & summaries, interactive mind maps, and accessibility settings. |
| **File Processing** | **Multer + PDF-Parse + Mammoth** | Accepts PDF, Word (.docx), Markdown, TXT, CSV, JSON, and Images up to 25MB with instant OCR / text extraction, auto-summarization, and grounded Q&A. |
| **Mind Map Visual Export** | **jsPDF + html2canvas + SVG** | Generates Broadsheet-styled visual PDF documents, 2.5× retina PNG images, standalone SVG vectors, Markdown, and JSON. |
| **Frontend Web App** | **React 18 + Vite + Tailwind CSS** | Clean accessible broadsheet interface tailored for ADHD, dyslexia, and neurodivergent cognition. |

---

## 2. Manual Action Items (Required from your side)

To make the application fully operational, please complete the following manual steps:

### Step 1: Obtain an OpenRouter API Key
1. Visit **[OpenRouter.ai](https://openrouter.ai/)** and sign up or sign in.
2. Go to **[OpenRouter Keys](https://openrouter.ai/keys)** and click **Create Key**.
3. Copy the generated API key (starts with `sk-or-v1-...`).
4. Add credits to your OpenRouter account or select free-tier models (e.g. `google/gemini-2.0-flash-lite-preview-02-05:free`, `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`).

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

# --- 1. Primary AI Engine (OpenRouter) ---
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_MODEL_CHAIN=google/gemini-2.5-flash,anthropic/claude-3.5-haiku,meta-llama/llama-3.3-70b-instruct,deepseek/deepseek-chat,openai/gpt-4o-mini
OPENROUTER_APP_NAME="SETU Cognitive Sanctuary"
OPENROUTER_SITE_URL="https://setu-sanctuary.app"

# --- 2. Secondary & Tertiary AI Fallbacks (Optional) ---
GEMINI_API_KEY=
GEMINI_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# --- 3. MongoDB Database Persistence ---
MONGODB_URI=mongodb+srv://setu_user:yourpassword@cluster0.abcde.mongodb.net/setu?retryWrites=true&w=majority

# --- 4. Engine Server Settings ---
PORT=3000
NODE_ENV=development
AI_TIMEOUT_MS=60000
AI_MAX_RETRIES=3
AI_MAX_RETRY_WAIT_MS=15000

# --- 5. Web App (Production Only) ---
# Leave blank in development (Vite proxies /api to PORT 3000 automatically)
VITE_API_URL=
```

---

## 3. Environment Variables Reference Table

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | **Recommended** | `null` | Primary API key for OpenRouter engine. |
| `OPENROUTER_MODEL` | Optional | `google/gemini-2.5-flash` | The preferred primary model identifier on OpenRouter. |
| `OPENROUTER_MODEL_CHAIN` | Optional | Multi-model list | Comma-separated list of fallback models tried sequentially when limits or errors occur. |
| `MONGODB_URI` | **Recommended** | `mongodb://127.0.0.1:27017/setu` | MongoDB database connection string (local or MongoDB Atlas). |
| `GEMINI_API_KEY` | Optional | `null` | Google Gemini API key used as direct secondary fallback. |
| `OPENAI_API_KEY` | Optional | `null` | OpenAI API key used as direct tertiary fallback. |
| `PORT` | Optional | `3000` | Port for Express backend server. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development`, `production`, `test`). |
| `AI_TIMEOUT_MS` | Optional | `60000` | Timeout per AI request in milliseconds (60 seconds). |
| `AI_MAX_RETRIES` | Optional | `3` | Maximum retry attempts per model with exponential backoff. |
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
  AI Engine       : OpenRouter (google/gemini-2.5-flash) [Fallback Chain Active]
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

1. **OpenRouter AI with Automatic Fallback**:
   - Seamlessly switches to alternative models if quota, balance, or provider errors hit.
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
