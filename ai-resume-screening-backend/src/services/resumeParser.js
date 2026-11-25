import { createRequire } from "module";

const require = createRequire(import.meta.url);

/**
 * Extracts plain text from an uploaded PDF or text buffer.
 * Uses pdf-parse's core module path to avoid its test-fixture side effect in ESM.
 */
export async function extractResumeText(file) {
  if (!file) return "";

  const mime = (file.mimetype || "").toLowerCase();
  const name = (file.originalname || "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(file.buffer);
    return (parsed?.text || "").trim();
  }

  return file.buffer.toString("utf-8").trim();
}

/**
 * Best-effort regex extraction used as fallback when an LLM does not return contact metadata.
 */
export function extractBasicContactInfo(text = "") {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/);
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 1 && line.length < 60 && !line.includes("@"));

  return {
    name: firstLine || "Unknown Candidate",
    email: emailMatch ? emailMatch[0].toLowerCase() : "",
    phone: phoneMatch ? phoneMatch[0].trim() : "",
  };
}
