# AI Resume Screening & Candidate Shortlisting — MERN Backend

Express + MongoDB + LLM backend for screening uploaded PDF/TXT resumes against job descriptions and shortlisting top candidates.

## Setup

1. Copy `.env.example` to `.env` and fill in your `MONGODB_URI`, `CLIENT_ORIGIN`, and `GEMINI_API_KEY` (or `OPENAI_API_KEY`):
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the server:
   ```bash
   npm run dev
   ```

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server, DB, and active LLM status |
| `GET` | `/api/jobs` | List jobs with candidate & shortlist stats |
| `POST` | `/api/jobs` | Create a job posting |
| `GET` | `/api/jobs/:id` | Get a single job |
| `PUT` | `/api/jobs/:id` | Update a job |
| `DELETE` | `/api/jobs/:id` | Delete a job and its candidates |
| `GET` | `/api/candidates` | List/filter candidates (`jobId`, `status`, `minScore`, `search`) |
| `POST` | `/api/candidates/screen` | Upload `resumes`/`resume` files or `resumeText` to score & auto-shortlist |
| `POST` | `/api/candidates/shortlist/auto` | Re-run shortlisting by `minScore` and/or `topN` |
| `PATCH` | `/api/candidates/:id/status` | Update status (`pending`, `shortlisted`, `interview`, `rejected`) |
| `DELETE` | `/api/candidates/:id` | Delete a candidate |
