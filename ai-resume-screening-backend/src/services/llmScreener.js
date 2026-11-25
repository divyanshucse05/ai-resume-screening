import { extractBasicContactInfo } from "./resumeParser.js";

function buildPrompt(job, resumeText) {
  const skills = Array.isArray(job.requiredSkills) && job.requiredSkills.length > 0
    ? job.requiredSkills.join(", ")
    : "Infer from job description";

  return `You are an expert technical recruiter and ATS resume screener.
Evaluate the candidate's resume against the job requirements and return ONLY valid JSON matching this schema:
{
  "candidateName": "string",
  "email": "string",
  "phone": "string",
  "experienceYears": number,
  "education": "string",
  "extractedSkills": ["string"],
  "matchScore": number (integer 0-100),
  "matchedSkills": ["string"],
  "missingSkills": ["string"],
  "summary": "2-3 sentence concise evaluation",
  "strengths": ["string"],
  "concerns": ["string"]
}

JOB DETAILS:
- Title: ${job.title}
- Minimum Experience (years): ${job.minExperienceYears ?? 0}
- Required Skills: ${skills}
- Description:
${job.description}

CANDIDATE RESUME:
${resumeText.slice(0, 15000)}`;
}

function clampScore(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeAnalysis(raw, resumeText, provider) {
  const fallbackContact = extractBasicContactInfo(resumeText);

  return {
    name: raw.candidateName?.trim() || fallbackContact.name,
    email: raw.email?.trim() || fallbackContact.email,
    phone: raw.phone?.trim() || fallbackContact.phone,
    experienceYears: Math.max(0, Number(raw.experienceYears) || 0),
    education: raw.education?.trim() || "",
    extractedSkills: Array.isArray(raw.extractedSkills) ? raw.extractedSkills : [],
    matchScore: clampScore(raw.matchScore),
    matchedSkills: Array.isArray(raw.matchedSkills) ? raw.matchedSkills : [],
    missingSkills: Array.isArray(raw.missingSkills) ? raw.missingSkills : [],
    summary: raw.summary?.trim() || "Screened against job requirements.",
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    concerns: Array.isArray(raw.concerns) ? raw.concerns : [],
    aiProvider: provider,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiModel(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini API error (${response.status}): ${errText}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini API returned an empty response.");
  }
  return JSON.parse(text);
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const candidateModels = [...new Set([primaryModel, "gemini-3.8-flash", "gemini-3.5-flash-lite"])];

  let lastError = null;
  let lastTransientError = null;
  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callGeminiModel(model, apiKey, prompt);
        return { raw, model };
      } catch (err) {
        lastError = err;
        const transient = err.status === 429 || err.status === 503;
        if (transient) {
          lastTransientError = err;
        }
        if (transient && attempt === 0) {
          await sleep(1200);
          continue;
        }
        if (transient || err.status === 404) {
          break; // try next fallback model
        }
        throw err;
      }
    }
  }

  throw lastTransientError || lastError;
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are an ATS resume screener that outputs strict JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
  throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI API returned an empty response.");
  }
  return JSON.parse(text);
}

/**
 * Deterministic keyword fallback when no LLM API key is configured.
 */
function fallbackKeywordScreen(job, resumeText, provider = "keyword-fallback") {
  const lowerResume = resumeText.toLowerCase();
  const skills = (job.requiredSkills || [])
    .map((s) => s.trim())
    .filter(Boolean);

  const fallbackKeywords =
    skills.length > 0
      ? skills
      : (job.description || "")
          .toLowerCase()
          .split(/[^a-z0-9+#.]+/)
          .filter((w) => w.length >= 3)
          .slice(0, 12);

  const matchedSkills = fallbackKeywords.filter((skill) =>
    lowerResume.includes(skill.toLowerCase())
  );
  const missingSkills = fallbackKeywords.filter(
    (skill) => !lowerResume.includes(skill.toLowerCase())
  );

  const ratio = fallbackKeywords.length > 0 ? matchedSkills.length / fallbackKeywords.length : 0.5;
  const matchScore = Math.round(ratio * 100);
  const expMatch = resumeText.match(/(\d+)\+?\s*years?/i);
  const experienceYears = expMatch ? Number(expMatch[1]) : 0;

  return normalizeAnalysis(
    {
      experienceYears,
      extractedSkills: matchedSkills,
      matchScore,
      matchedSkills,
      missingSkills,
      summary: `Keyword fallback evaluation matched ${matchedSkills.length} of ${fallbackKeywords.length} target criteria.`,
      strengths: matchedSkills.length > 0 ? [`Matches skills: ${matchedSkills.join(", ")}`] : [],
      concerns: missingSkills.length > 0 ? [`Missing skills: ${missingSkills.join(", ")}`] : [],
    },
    resumeText,
    provider
  );
}

export async function screenResumeWithLLM(job, resumeText) {
  const preferred = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const prompt = buildPrompt(job, resumeText);

  const useGemini =
    (preferred === "gemini" && process.env.GEMINI_API_KEY) ||
    (preferred !== "openai" && preferred !== "mock" && process.env.GEMINI_API_KEY);

  if (useGemini) {
    try {
      const { raw, model } = await callGemini(prompt);
      return normalizeAnalysis(raw, resumeText, `gemini:${model}`);
    } catch (err) {
      if (err.status === 429 || err.status === 503) {
        console.warn(`Gemini unavailable (${err.status}); falling back to keyword screening.`);
        return fallbackKeywordScreen(job, resumeText, "keyword-fallback (gemini-busy)");
      }
      throw err;
    }
  }

  if (process.env.OPENAI_API_KEY && preferred !== "mock") {
    const raw = await callOpenAI(prompt);
    return normalizeAnalysis(raw, resumeText, `openai:${process.env.OPENAI_MODEL || "gpt-4o-mini"}`);
  }

  return fallbackKeywordScreen(job, resumeText);
}
