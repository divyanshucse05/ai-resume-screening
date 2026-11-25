import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { Job } from "../models/Job.js";
import { Candidate } from "../models/Candidate.js";
import { extractResumeText } from "../services/resumeParser.js";
import { screenResumeWithLLM } from "../services/llmScreener.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/octet-stream",
    ];
    const extAllowed = /\.(pdf|txt|md)$/i.test(file.originalname || "");
    if (allowed.includes(file.mimetype) || extAllowed) {
      return cb(null, true);
    }
    cb(new Error("Only PDF, TXT, and MD resume files are supported."));
  },
});

// Accept either "resumes" (multiple) or "resume" (single) file upload fields
const uploadMiddleware = upload.fields([
  { name: "resumes", maxCount: 20 },
  { name: "resume", maxCount: 1 },
]);

// List & filter candidates
router.get("/", async (req, res, next) => {
  try {
    const { jobId, status, minScore, search } = req.query;
    const filter = {};

    if (jobId) {
      if (!mongoose.isValidObjectId(jobId)) {
        return res.status(400).json({ error: "Invalid jobId filter." });
      }
      filter.jobId = jobId;
    }
    if (status && status !== "all") {
      filter.status = status;
    }
    if (minScore !== undefined && minScore !== "") {
      filter.matchScore = { $gte: Number(minScore) || 0 };
    }
    if (search) {
      const regex = new RegExp(String(search).trim(), "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { extractedSkills: regex },
        { summary: regex },
      ];
    }

    const candidates = await Candidate.find(filter)
      .populate("jobId", "title department shortlistThreshold")
      .sort({ matchScore: -1, createdAt: -1 })
      .lean();

    res.json({ candidates });
  } catch (err) {
    next(err);
  }
});

// Get single candidate
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid candidate ID." });
    }
    const candidate = await Candidate.findById(req.params.id).populate(
      "jobId",
      "title department shortlistThreshold"
    );
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found." });
    }
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
});

// Screen one or more uploaded resumes (or raw resumeText) against a Job
router.post("/screen", uploadMiddleware, async (req, res, next) => {
  try {
    const { jobId, jobTitle, jobDescription, requiredSkills, resumeText, name, email, phone } =
      req.body;

    let job = null;
    if (jobId) {
      if (!mongoose.isValidObjectId(jobId)) {
        return res.status(400).json({ error: "Invalid jobId." });
      }
      job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Target job not found." });
      }
    } else if (jobDescription) {
      job = await Job.create({
        title: jobTitle || "General Role",
        description: jobDescription,
        requiredSkills: Array.isArray(requiredSkills)
          ? requiredSkills
          : typeof requiredSkills === "string"
          ? requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      });
    } else {
      return res
        .status(400)
        .json({ error: "Provide either an existing jobId or a jobDescription." });
    }

    const uploadedFiles = [
      ...(req.files?.resumes || []),
      ...(req.files?.resume || []),
    ];

    const itemsToScreen = [];
    for (const file of uploadedFiles) {
      const text = await extractResumeText(file);
      if (text) {
        itemsToScreen.push({ fileName: file.originalname, text });
      }
    }

    if (itemsToScreen.length === 0 && resumeText && String(resumeText).trim()) {
      itemsToScreen.push({ fileName: "pasted-resume.txt", text: String(resumeText).trim() });
    }

    if (itemsToScreen.length === 0) {
      return res
        .status(400)
        .json({ error: "Upload at least one PDF/TXT resume or provide resumeText." });
    }

    const threshold = job.shortlistThreshold ?? 70;
    const screened = [];

    for (const item of itemsToScreen) {
      const analysis = await screenResumeWithLLM(job, item.text);
      const status = analysis.matchScore >= threshold ? "shortlisted" : "pending";

      const candidate = await Candidate.create({
        jobId: job._id,
        name: name || analysis.name,
        email: email || analysis.email,
        phone: phone || analysis.phone,
        resumeFileName: item.fileName,
        resumeText: item.text,
        extractedSkills: analysis.extractedSkills,
        experienceYears: analysis.experienceYears,
        education: analysis.education,
        matchScore: analysis.matchScore,
        matchedSkills: analysis.matchedSkills,
        missingSkills: analysis.missingSkills,
        summary: analysis.summary,
        strengths: analysis.strengths,
        concerns: analysis.concerns,
        status,
        aiProvider: analysis.aiProvider,
      });

      screened.push(candidate);
    }

    screened.sort((a, b) => b.matchScore - a.matchScore);
    res.status(201).json({ job, candidates: screened });
  } catch (err) {
    next(err);
  }
});

// Auto-shortlist candidates for a job by threshold or topN
router.post("/shortlist/auto", async (req, res, next) => {
  try {
    const { jobId, minScore, topN } = req.body;
    if (!jobId || !mongoose.isValidObjectId(jobId)) {
      return res.status(400).json({ error: "Valid jobId is required." });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    const threshold = minScore !== undefined ? Number(minScore) : job.shortlistThreshold;
    const candidates = await Candidate.find({ jobId }).sort({ matchScore: -1 });

    const shortlistedIds = [];
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const meetsScore = candidate.matchScore >= threshold;
      const withinTopN = topN ? i < Number(topN) : true;
      const nextStatus = meetsScore && withinTopN ? "shortlisted" : "rejected";

      if (candidate.status !== nextStatus) {
        candidate.status = nextStatus;
        await candidate.save();
      }
      if (nextStatus === "shortlisted") {
        shortlistedIds.push(candidate._id);
      }
    }

    res.json({
      message: `Shortlisted ${shortlistedIds.length} of ${candidates.length} candidates.`,
      shortlistedCount: shortlistedIds.length,
      candidates,
    });
  } catch (err) {
    next(err);
  }
});

// Update candidate status manually (shortlisted | interview | rejected | pending)
router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid candidate ID." });
    }
    const { status } = req.body;
    const allowed = ["pending", "shortlisted", "interview", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(", ")}` });
    }

    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found." });
    }
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
});

// Delete candidate
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid candidate ID." });
    }
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found." });
    }
    res.json({ message: "Candidate deleted." });
  } catch (err) {
    next(err);
  }
});

export default router;
