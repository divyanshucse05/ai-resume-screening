import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "Unknown Candidate",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    resumeFileName: {
      type: String,
      default: "",
    },
    resumeText: {
      type: String,
      required: [true, "Resume text is required"],
    },
    extractedSkills: {
      type: [String],
      default: [],
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    education: {
      type: String,
      default: "",
    },
    matchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    matchedSkills: {
      type: [String],
      default: [],
    },
    missingSkills: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      default: "",
    },
    strengths: {
      type: [String],
      default: [],
    },
    concerns: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "shortlisted", "interview", "rejected"],
      default: "pending",
      index: true,
    },
    aiProvider: {
      type: String,
      default: "mock",
    },
  },
  { timestamps: true }
);

export const Candidate = mongoose.model("Candidate", candidateSchema);
