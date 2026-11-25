import { Router } from "express";
import mongoose from "mongoose";
import { Job } from "../models/Job.js";
import { Candidate } from "../models/Candidate.js";

const router = Router();

function parseSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof skills === "string") {
    return skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// List all jobs with candidate counts
router.get("/", async (req, res, next) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    const counts = await Candidate.aggregate([
      {
        $group: {
          _id: "$jobId",
          totalCandidates: { $sum: 1 },
          shortlistedCount: {
            $sum: { $cond: [{ $eq: ["$status", "shortlisted"] }, 1, 0] },
          },
          avgScore: { $avg: "$matchScore" },
        },
      },
    ]);

    const statsByJob = new Map(counts.map((c) => [String(c._id), c]));

    const enriched = jobs.map((job) => {
      const stats = statsByJob.get(String(job._id));
      return {
        ...job,
        totalCandidates: stats?.totalCandidates ?? 0,
        shortlistedCount: stats?.shortlistedCount ?? 0,
        avgScore: stats?.avgScore ? Math.round(stats.avgScore) : 0,
      };
    });

    res.json({ jobs: enriched });
  } catch (err) {
    next(err);
  }
});

// Create a job posting
router.post("/", async (req, res, next) => {
  try {
    const {
      title,
      department,
      location,
      description,
      requiredSkills,
      minExperienceYears,
      shortlistThreshold,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Both title and description are required." });
    }

    const job = await Job.create({
      title,
      department,
      location,
      description,
      requiredSkills: parseSkills(requiredSkills),
      minExperienceYears: Number(minExperienceYears) || 0,
      shortlistThreshold:
        shortlistThreshold !== undefined ? Number(shortlistThreshold) : 70,
    });

    res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
});

// Get single job
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid job ID." });
    }
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

// Update job
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid job ID." });
    }
    const updates = { ...req.body };
    if (updates.requiredSkills !== undefined) {
      updates.requiredSkills = parseSkills(updates.requiredSkills);
    }

    const job = await Job.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

// Delete job and associated candidates
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid job ID." });
    }
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    await Candidate.deleteMany({ jobId: job._id });
    res.json({ message: "Job and associated candidates deleted." });
  } catch (err) {
    next(err);
  }
});

export default router;
