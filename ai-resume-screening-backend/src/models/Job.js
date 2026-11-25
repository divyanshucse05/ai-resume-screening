import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      default: "Engineering",
    },
    location: {
      type: String,
      trim: true,
      default: "Remote",
    },
    description: {
      type: String,
      required: [true, "Job description is required"],
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    minExperienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortlistThreshold: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

export const Job = mongoose.model("Job", jobSchema);
