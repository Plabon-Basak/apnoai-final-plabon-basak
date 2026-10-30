# AI Career Copilot

AI Career Copilot is a lightweight web application that analyzes a resume against a job description using Google's Gemini API and provides actionable ATS-focused feedback. It runs as a static frontend with a Vercel serverless function backend.

## Key Features

- **Gemini-powered resume analysis** – Sends resume and job description to the `/api/analyze` serverless function, which calls the Google Gemini API to generate structured feedback.
- **ATS match score** – Returns an integer ATS score (0-100) with a visual score ring and match category.
- **AI-generated resume summary** – Provides a concise evaluation of the candidate's suitability for the role.
- **Strengths identification** – Lists specific strengths supported by evidence from the resume.
- **Missing keyword identification** – Highlights missing skills or qualifications from the job description as distinct chips.
- **Resume improvement recommendations** – Suggests specific, actionable improvements.
- **PDF resume upload and client-side text extraction** – Upload a PDF (up to 5 MB) and extract readable text in-browser using PDF.js.
- **Manual resume text editing** – Extracted PDF text or pasted text can be edited directly in the resume textarea before analysis.

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js / Vercel serverless functions (`api/analyze.js`)
- **AI**: Google Gemini API via `@google/genai`
- **PDF Parsing**: PDF.js (loaded from CDN)

## How the Application Works

1. The user pastes a resume and job description (or uploads a PDF to auto-fill the resume field).
2. The frontend validates inputs client-side (presence, minimum length of 50 characters, and maximum character limits).
3. On submit, the frontend sends a `POST` request to `/api/analyze` with `JSON` body `{ resume, jobDescription }`.
4. The serverless function validates the request, reads `GEMINI_API_KEY` from environment variables, and calls Gemini with a strict system prompt.
5. The function validates the structured JSON response from Gemini and returns it to the frontend.
6. The frontend renders the ATS score, summary, strengths, missing keywords, and recommendations.

## Local Setup Instructions

1. **Install Node.js** – Use a recent LTS version of Node.js.
2. **Clone the repository** – Clone this project to your local machine.
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Configure environment variables** – Create a `.env.local` file in the project root and add:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   (See Environment Variable Documentation below.)
5. **Run the app with Vercel CLI**:
   ```bash
   vercel dev
   ```
   This runs the static frontend and the `/api/analyze` serverless function locally.

## Environment Variable Documentation

- **Name:** `GEMINI_API_KEY`
- **Purpose:** Used server-side by `api/analyze.js` to authenticate requests to the Google Gemini API.
- **Important:** This key must remain server-side only. It must never be committed to version control or exposed in client-side code. Use `.env.local` for local development and Vercel Environment Variables for deployment.

## Deployment Instructions for Vercel

1. Push the repository to your Git provider.
2. Import the project into Vercel.
3. In Vercel Project Settings → Environment Variables, add `GEMINI_API_KEY` for the appropriate environments (Development/Preview/Production).
4. Deploy. Vercel will serve `index.html` as the static frontend and `api/analyze.js` as a serverless function at `/api/analyze`.

## Usage Instructions

1. Open the application.
2. (Optional) Upload a PDF resume using the "Your Resume" upload field to extract text automatically.
3. Paste or edit the resume text in the resume textarea.
4. Paste the job description in the "Job Description" textarea.
5. Click **Analyze Resume** to generate feedback.
6. Review the ATS score, summary, strengths, missing keywords, and recommended improvements.

## Privacy Note

Resume and job description text are sent from the browser to the backend serverless function (`/api/analyze`) and forwarded to the Google Gemini API for analysis. No resume or job description data is stored by this application. API credentials remain server-side only.

## Author

**Plabon Basak**

ApnoAI AI/ML Intern · October 2026
