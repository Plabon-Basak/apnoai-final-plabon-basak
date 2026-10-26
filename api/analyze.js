
import { GoogleGenAI } from "@google/genai";

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = [500, 502, 503, 504];

const SYSTEM_PROMPT = `
You are an expert ATS resume evaluator, professional recruiter,
and AI/ML career advisor.

Your task is to analyze a candidate's resume against a specific
job description.

Evaluate:
1. Technical skills and tools.
2. Relevant work experience.
3. Education and certifications.
4. Required qualifications.
5. Preferred qualifications.
6. Missing skills and keywords.
7. Resume quality and measurable achievements.

IMPORTANT RULES:

- Evaluate only information actually present in the resume.
- Never invent experience, qualifications, skills, or achievements.
- Distinguish required qualifications from preferred qualifications.
- Do not penalize candidates heavily for missing preferred skills.
- Do not assume experience duration. Calculate it only when dates
  provide sufficient evidence.
- Do not recommend adding a keyword unless the candidate genuinely
  has that skill or experience.
- Explain skill gaps honestly.
- Consider transferable skills and relevant projects.
- ATS score must be an integer between 0 and 100.
- Scores must reflect actual alignment with the job description.
- A high score does not guarantee an interview.
- Be constructive and specific in your recommendations.
- Focus on evidence rather than generic praise.

Return ONLY valid JSON using this exact structure:

{
  "ats_score": 75,
  "summary": "A concise evaluation of the candidate's suitability.",
  "strengths": [
    "Specific strength supported by resume evidence."
  ],
  "missing_keywords": [
    "Missing skill or qualification."
  ],
  "improvements": [
    "Specific and actionable recommendation."
  ]
}

All fields are required.
The three list fields must always be arrays of strings.
`;

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getErrorStatus(error) {
  return (
    error?.status ||
    error?.code ||
    error?.error?.code ||
    error?.response?.status ||
    500
  );
}

function extractJSON(text) {
  let cleaned = text.trim();

  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return valid JSON.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function validateAnalysis(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("Invalid analysis response.");
  }

  if (
    !Number.isInteger(data.ats_score) ||
    data.ats_score < 0 ||
    data.ats_score > 100
  ) {
    throw new Error("Invalid ATS score.");
  }

  if (
    typeof data.summary !== "string" ||
    !data.summary.trim()
  ) {
    throw new Error("Invalid analysis summary.");
  }

  const arrayFields = [
    "strengths",
    "missing_keywords",
    "improvements"
  ];

  for (const field of arrayFields) {
    if (
      !Array.isArray(data[field]) ||
      !data[field].every(
        (item) => typeof item === "string"
      )
    ) {
      throw new Error(`Invalid ${field} field.`);
    }
  }

  return {
    ats_score: data.ats_score,
    summary: data.summary,
    strengths: data.strengths,
    missing_keywords: data.missing_keywords,
    improvements: data.improvements
  };
}

async function generateAnalysis(ai, resume, jobDescription) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(
        `Gemini analysis attempt ${attempt}/${MAX_ATTEMPTS}`
      );

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `
Analyze the following resume against the job description.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Follow the system instructions and return only valid JSON.
`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response.");
      }

      const parsed = extractJSON(response.text);

      return validateAnalysis(parsed);

    } catch (error) {
      const status = Number(getErrorStatus(error));

      console.error(
        `Gemini attempt ${attempt} failed:`,
        status,
        error.message
      );

      // Quota exhaustion: do not retry.
      if (status === 429) {
        const quotaError = new Error(
          "Gemini API daily quota has been exceeded. Please try again after your quota resets."
        );

        quotaError.status = 429;
        throw quotaError;
      }

      // Authentication or permission error: do not retry.
      if (status === 401 || status === 403) {
        const authError = new Error(
          "Gemini API authentication failed. Please check the API configuration."
        );

        authError.status = 502;
        throw authError;
      }

      // Retry only temporary server errors.
      if (
        RETRYABLE_STATUSES.includes(status) &&
        attempt < MAX_ATTEMPTS
      ) {
        const waitTime = 1000 * Math.pow(2, attempt - 1);

        console.log(
          `Retrying Gemini in ${waitTime}ms...`
        );

        await delay(waitTime);
        continue;
      }

      // Invalid JSON or other non-retryable errors.
      if (RETRYABLE_STATUSES.includes(status)) {
        const serverError = new Error(
          "Gemini is temporarily unavailable. Please try again later."
        );

        serverError.status = 503;
        throw serverError;
      }

      throw error;
    }
  }

  throw new Error("Resume analysis failed.");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured.");

    return res.status(500).json({
      error: "Server configuration error. Gemini API key is missing."
    });
  }

  const { resume, jobDescription } = req.body || {};

  if (
    typeof resume !== "string" ||
    typeof jobDescription !== "string"
  ) {
    return res.status(400).json({
      error: "Resume and job description must be text."
    });
  }

  const cleanResume = resume.trim();
  const cleanJobDescription = jobDescription.trim();

  if (cleanResume.length < 50) {
    return res.status(400).json({
      error: "Resume must contain at least 50 characters."
    });
  }

  if (cleanResume.length > 20000) {
    return res.status(400).json({
      error: "Resume cannot exceed 20,000 characters."
    });
  }

  if (cleanJobDescription.length < 50) {
    return res.status(400).json({
      error: "Job description must contain at least 50 characters."
    });
  }

  if (cleanJobDescription.length > 15000) {
    return res.status(400).json({
      error: "Job description cannot exceed 15,000 characters."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey
    });

    const analysis = await generateAnalysis(
      ai,
      cleanResume,
      cleanJobDescription
    );

    return res.status(200).json(analysis);

  } catch (error) {
    const status = Number(error.status) || 500;

    console.error("Resume analysis failed:", error.message);

    if (status === 429) {
      return res.status(429).json({
        error: error.message
      });
    }

    if (status === 502) {
      return res.status(502).json({
        error: error.message
      });
    }

    if (status === 503) {
      return res.status(503).json({
        error: error.message
      });
    }

    return res.status(500).json({
      error: "Resume analysis failed. Please try again later."
    });
  }
}
