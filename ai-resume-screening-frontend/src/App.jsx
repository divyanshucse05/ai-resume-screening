import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "./api/client";

const SAMPLE_JOB = {
  title: "Full Stack MERN Developer",
  department: "Engineering",
  location: "Remote",
  minExperienceYears: 1,
  shortlistThreshold: 70,
  requiredSkills: "React, Node.js, Express, MongoDB, REST API, JavaScript",
  description:
    "Looking for a MERN stack developer experienced in building React dashboards, Express REST APIs, MongoDB schemas, and integrating LLM/AI services.",
};

const SAMPLE_RESUME = `Aarav Sharma
aarav.sharma@example.com | +91 98765 43210
B.Tech in Computer Science (2024)

SUMMARY
Full Stack MERN Developer with 2 years of experience building scalable web applications using React, Node.js, Express, and MongoDB.

SKILLS
JavaScript, TypeScript, React, Redux, Node.js, Express, MongoDB, Mongoose, REST API, Git, Tailwind CSS, Gemini API

EXPERIENCE
Software Engineer — CloudCraft Labs (2024 - Present)
- Built React + Express analytics dashboards serving 15k monthly users.
- Designed MongoDB aggregation pipelines and integrated LLM APIs for automated document summarization.`;

export default function App() {
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidates, setCandidates] = useState([]);

  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "",
    department: "Engineering",
    location: "Remote",
    minExperienceYears: 0,
    shortlistThreshold: 70,
    requiredSkills: "",
    description: "",
  });

  const [inputMode, setInputMode] = useState("files");
  const [files, setFiles] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [topNInput, setTopNInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [screening, setScreening] = useState(false);
  const [banner, setBanner] = useState(null);

  const selectedJob = useMemo(
    () => jobs.find((j) => j._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  async function refreshAll(preferredJobId) {
    setLoading(true);
    try {
      const [healthRes, jobsRes] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getJobs(),
      ]);
      setHealth(healthRes);
      setJobs(jobsRes.jobs || []);

      const activeId =
        preferredJobId ||
        (jobsRes.jobs?.some((j) => j._id === selectedJobId)
          ? selectedJobId
          : jobsRes.jobs?.[0]?._id || "");

      setSelectedJobId(activeId);

      const candRes = await api.getCandidates({
        jobId: activeId || undefined,
        status: statusFilter,
        minScore: minScoreFilter || undefined,
        search: searchQuery || undefined,
      });
      setCandidates(candRes.candidates || []);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function refreshCandidates() {
    try {
      const res = await api.getCandidates({
        jobId: selectedJobId || undefined,
        status: statusFilter,
        minScore: minScoreFilter || undefined,
        search: searchQuery || undefined,
      });
      setCandidates(res.candidates || []);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    refreshCandidates();
  }, [selectedJobId, statusFilter, minScoreFilter, searchQuery]);

  async function handleCreateJob(e) {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await api.createJob(jobForm);
      setShowJobForm(false);
      setJobForm({
        title: "",
        department: "Engineering",
        location: "Remote",
        minExperienceYears: 0,
        shortlistThreshold: 70,
        requiredSkills: "",
        description: "",
      });
      setBanner({ type: "success", text: `Created job "${res.job.title}".` });
      await refreshAll(res.job._id);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  async function handleLoadSampleDemo() {
    setBanner(null);
    try {
      const res = await api.createJob(SAMPLE_JOB);
      setInputMode("text");
      setResumeText(SAMPLE_RESUME);
      setCandidateName("Aarav Sharma");
      setCandidateEmail("aarav.sharma@example.com");
      setBanner({
        type: "success",
        text: "Loaded sample Job Description and Resume. Click 'Screen with AI' to test!",
      });
      await refreshAll(res.job._id);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  async function handleDeleteJob(jobId) {
    if (!window.confirm("Delete this job and all its screened candidates?")) return;
    try {
      await api.deleteJob(jobId);
      setBanner({ type: "success", text: "Job deleted." });
      await refreshAll("");
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  async function handleScreen(e) {
    e.preventDefault();
    if (!selectedJobId) {
      setBanner({ type: "error", text: "Create or select a job role first." });
      return;
    }

    setScreening(true);
    setBanner(null);
    try {
      const payload =
        inputMode === "files"
          ? { jobId: selectedJobId, files }
          : {
              jobId: selectedJobId,
              resumeText,
              name: candidateName,
              email: candidateEmail,
            };

      const res = await api.screenResumes(payload);
      setFiles([]);
      setResumeText("");
      setCandidateName("");
      setCandidateEmail("");
      setBanner({
        type: "success",
        text: `Screened ${res.candidates.length} candidate(s) successfully.`,
      });
      await refreshAll(selectedJobId);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setScreening(false);
    }
  }

  async function handleAutoShortlist() {
    if (!selectedJobId) return;
    setBanner(null);
    try {
      const res = await api.autoShortlist({
        jobId: selectedJobId,
        minScore: selectedJob?.shortlistThreshold ?? 70,
        topN: topNInput ? Number(topNInput) : undefined,
      });
      setBanner({ type: "success", text: res.message });
      await refreshAll(selectedJobId);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  async function handleStatusChange(candidateId, status) {
    try {
      await api.updateCandidateStatus(candidateId, status);
      await refreshAll(selectedJobId);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  async function handleDeleteCandidate(candidateId) {
    try {
      await api.deleteCandidate(candidateId);
      await refreshAll(selectedJobId);
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  }

  function exportShortlistedCSV() {
    const rows = candidates.filter((c) => c.status === "shortlisted" || c.status === "interview");
    if (rows.length === 0) {
      setBanner({ type: "error", text: "No shortlisted or interview candidates to export." });
      return;
    }

    const headers = ["Name", "Email", "Phone", "Match Score", "Status", "Experience (Yrs)", "Matched Skills"];
    const csvLines = [
      headers.join(","),
      ...rows.map((c) =>
        [
          c.name,
          c.email,
          c.phone,
          c.matchScore,
          c.status,
          c.experienceYears,
          (c.matchedSkills || []).join("; "),
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shortlisted-${selectedJob?.title?.toLowerCase().replace(/\s+/g, "-") || "candidates"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalCandidates = jobs.reduce((sum, j) => sum + (j.totalCandidates || 0), 0);
  const totalShortlisted = jobs.reduce((sum, j) => sum + (j.shortlistedCount || 0), 0);
  const avgScore = useMemo(() => {
    if (candidates.length === 0) return 0;
    return Math.round(
      candidates.reduce((sum, c) => sum + (c.matchScore || 0), 0) / candidates.length
    );
  }, [candidates]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h1>TalentPulse AI</h1>
            <p>AI Resume Screening & Candidate Shortlisting (MERN + LLM)</p>
          </div>
        </div>

        <div className="status-pills">
          <span className={`pill ${health?.status === "ok" ? "ok" : "err"}`}>
            API: {health?.status === "ok" ? "Online" : "Offline"}
          </span>
          <span className={`pill ${health?.database === "connected" ? "ok" : "warn"}`}>
            MongoDB: {health?.database || "unknown"}
          </span>
          <span className="pill">LLM: {health?.llmProvider || "offline"}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLoadSampleDemo}>
            <Sparkles size={14} /> Load Demo Data
          </button>
        </div>
      </header>

      <main className="container">
        {banner && (
          <div className={`alert ${banner.type === "error" ? "alert-error" : "alert-success"}`}>
            {banner.text}
          </div>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div>
              <div className="stat-label">Open Job Roles</div>
              <div className="stat-value">{jobs.length}</div>
            </div>
            <div className="stat-icon">
              <Briefcase size={20} />
            </div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Screened Resumes</div>
              <div className="stat-value">{totalCandidates}</div>
            </div>
            <div className="stat-icon">
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Shortlisted Candidates</div>
              <div className="stat-value">{totalShortlisted}</div>
            </div>
            <div className="stat-icon">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Avg Match Score (View)</div>
              <div className="stat-value">{avgScore}%</div>
            </div>
            <div className="stat-icon">
              <Sparkles size={20} />
            </div>
          </div>
        </section>

        <div className="main-grid">
          {/* Left Column: Jobs */}
          <aside className="panel">
            <div className="panel-header">
              <h2>
                <Briefcase size={17} /> Job Roles
              </h2>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowJobForm((v) => !v)}
              >
                <Plus size={15} /> {showJobForm ? "Close" : "New Job"}
              </button>
            </div>

            <div className="panel-body stack">
              {showJobForm && (
                <form className="stack" onSubmit={handleCreateJob}>
                  <div className="field">
                    <label>Job Title *</label>
                    <input
                      className="input"
                      required
                      placeholder="e.g., Full Stack MERN Developer"
                      value={jobForm.title}
                      onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    />
                  </div>
                  <div className="row">
                    <div className="field" style={{ flex: 1 }}>
                      <label>Department</label>
                      <input
                        className="input"
                        value={jobForm.department}
                        onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Location</label>
                      <input
                        className="input"
                        value={jobForm.location}
                        onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field" style={{ flex: 1 }}>
                      <label>Min Exp (Yrs)</label>
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={jobForm.minExperienceYears}
                        onChange={(e) =>
                          setJobForm({ ...jobForm, minExperienceYears: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Shortlist Cutoff (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input"
                        value={jobForm.shortlistThreshold}
                        onChange={(e) =>
                          setJobForm({ ...jobForm, shortlistThreshold: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Required Skills (comma-separated)</label>
                    <input
                      className="input"
                      placeholder="React, Node.js, MongoDB, Express"
                      value={jobForm.requiredSkills}
                      onChange={(e) => setJobForm({ ...jobForm, requiredSkills: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Job Description *</label>
                    <textarea
                      className="textarea"
                      required
                      placeholder="Describe responsibilities, tech stack, and qualifications..."
                      value={jobForm.description}
                      onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Save Job Role
                  </button>
                </form>
              )}

              <div className="job-list">
                {jobs.length === 0 ? (
                  <div className="empty-state">
                    No job roles yet. Click <strong>New Job</strong> or{" "}
                    <strong>Load Demo Data</strong>.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div
                      key={job._id}
                      className={`job-card ${job._id === selectedJobId ? "active" : ""}`}
                      onClick={() => setSelectedJobId(job._id)}
                    >
                      <div className="job-card-top">
                        <div>
                          <div className="job-title">{job.title}</div>
                          <div className="job-meta">
                            {job.department} · {job.location} · Cutoff {job.shortlistThreshold}%
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Delete job"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteJob(job._id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="job-meta" style={{ marginTop: 8 }}>
                        {job.totalCandidates || 0} screened ·{" "}
                        <strong>{job.shortlistedCount || 0} shortlisted</strong> · Avg{" "}
                        {job.avgScore || 0}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Right Column: Screening + Candidate Shortlist */}
          <div className="stack" style={{ gap: 24 }}>
            <section className="panel">
              <div className="panel-header">
                <h2>
                  <Upload size={17} /> Screen Resumes{" "}
                  {selectedJob ? `for ${selectedJob.title}` : ""}
                </h2>
                <div className="tabs">
                  <button
                    type="button"
                    className={`tab ${inputMode === "files" ? "active" : ""}`}
                    onClick={() => setInputMode("files")}
                  >
                    Upload PDF / TXT
                  </button>
                  <button
                    type="button"
                    className={`tab ${inputMode === "text" ? "active" : ""}`}
                    onClick={() => setInputMode("text")}
                  >
                    Paste Resume Text
                  </button>
                </div>
              </div>

              <form className="panel-body stack" onSubmit={handleScreen}>
                {selectedJob && (
                  <div className="file-chips">
                    {(selectedJob.requiredSkills || []).map((skill) => (
                      <span key={skill} className="chip">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {inputMode === "files" ? (
                  <>
                    <label className="dropzone">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.txt,.md"
                        style={{ display: "none" }}
                        onChange={(e) => setFiles(Array.from(e.target.files || []))}
                      />
                      <FileText size={26} style={{ color: "var(--primary)" }} />
                      <div style={{ fontWeight: 600, marginTop: 6 }}>
                        Click to choose PDF or TXT resumes (up to 20)
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        Files are parsed and scored automatically against the selected job role
                      </div>
                    </label>
                    {files.length > 0 && (
                      <div className="file-chips">
                        {files.map((f) => (
                          <span key={f.name} className="chip">
                            {f.name} ({Math.ceil(f.size / 1024)} KB)
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="stack">
                    <div className="row">
                      <div className="field" style={{ flex: 1 }}>
                        <label>Candidate Name (optional)</label>
                        <input
                          className="input"
                          placeholder="Auto-extracted if blank"
                          value={candidateName}
                          onChange={(e) => setCandidateName(e.target.value)}
                        />
                      </div>
                      <div className="field" style={{ flex: 1 }}>
                        <label>Candidate Email (optional)</label>
                        <input
                          className="input"
                          placeholder="Auto-extracted if blank"
                          value={candidateEmail}
                          onChange={(e) => setCandidateEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Resume Content *</label>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 140 }}
                        placeholder="Paste full resume text here..."
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      screening ||
                      !selectedJobId ||
                      (inputMode === "files" ? files.length === 0 : !resumeText.trim())
                    }
                  >
                    <Sparkles size={16} />
                    {screening ? "Screening with AI..." : "Screen with AI"}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>
                  <Users size={17} /> Ranked Candidates ({candidates.length})
                </h2>
                <div className="row">
                  <input
                    type="number"
                    min="1"
                    placeholder="Top N"
                    className="input"
                    style={{ width: 82, padding: "6px 8px" }}
                    value={topNInput}
                    onChange={(e) => setTopNInput(e.target.value)}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleAutoShortlist}
                    disabled={!selectedJobId}
                  >
                    Auto-Shortlist
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={exportShortlistedCSV}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              <div className="panel-body stack">
                <div className="row">
                  <div className="field" style={{ flex: 2, minWidth: 180 }}>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={15}
                        style={{
                          position: "absolute",
                          left: 10,
                          top: 11,
                          color: "var(--muted)",
                        }}
                      />
                      <input
                        className="input"
                        style={{ paddingLeft: 32 }}
                        placeholder="Search by name, skill, or summary..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <select
                    className="select"
                    style={{ flex: 1, minWidth: 140 }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interview">Interview</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    className="select"
                    style={{ flex: 1, minWidth: 130 }}
                    value={minScoreFilter}
                    onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                  >
                    <option value={0}>Any Score</option>
                    <option value={50}>Score &ge; 50%</option>
                    <option value={70}>Score &ge; 70%</option>
                    <option value={85}>Score &ge; 85%</option>
                  </select>
                </div>

                {loading ? (
                  <div className="empty-state">Loading candidates...</div>
                ) : candidates.length === 0 ? (
                  <div className="empty-state">
                    No candidates match the current filters. Upload or paste a resume above to
                    start screening.
                  </div>
                ) : (
                  <div className="candidate-list">
                    {candidates.map((c) => {
                      const scoreClass =
                        c.matchScore >= 75
                          ? "score-high"
                          : c.matchScore >= 50
                          ? "score-mid"
                          : "score-low";

                      return (
                        <article key={c._id} className="candidate-card">
                          <div className="candidate-top">
                            <div>
                              <div className="row" style={{ gap: 8 }}>
                                <strong style={{ fontSize: "1.02rem" }}>{c.name}</strong>
                                <span className={`status-badge status-${c.status}`}>
                                  {c.status}
                                </span>
                                <span className="pill">{c.aiProvider}</span>
                              </div>
                              <div className="job-meta">
                                {[c.email, c.phone, `${c.experienceYears || 0} yrs exp`, c.education]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            <div className={`score-badge ${scoreClass}`}>{c.matchScore}%</div>
                          </div>

                          <p style={{ margin: 0, fontSize: "0.9rem" }}>{c.summary}</p>

                          <div className="file-chips">
                            {(c.matchedSkills || []).map((s) => (
                              <span key={`m-${s}`} className="chip matched">
                                + {s}
                              </span>
                            ))}
                            {(c.missingSkills || []).map((s) => (
                              <span key={`x-${s}`} className="chip missing">
                                - {s}
                              </span>
                            ))}
                          </div>

                          {(c.strengths?.length > 0 || c.concerns?.length > 0) && (
                            <div className="insights-grid">
                              {c.strengths?.length > 0 && (
                                <div className="insight-box">
                                  <strong>Strengths</strong>
                                  <ul>
                                    {c.strengths.map((item, idx) => (
                                      <li key={idx}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {c.concerns?.length > 0 && (
                                <div className="insight-box">
                                  <strong>Gaps / Concerns</strong>
                                  <ul>
                                    {c.concerns.map((item, idx) => (
                                      <li key={idx}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <div className="row">
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleStatusChange(c._id, "shortlisted")}
                              >
                                <CheckCircle2 size={14} /> Shortlist
                              </button>
                              <button
                                className="btn btn-indigo btn-sm"
                                onClick={() => handleStatusChange(c._id, "interview")}
                              >
                                Interview
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleStatusChange(c._id, "rejected")}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDeleteCandidate(c._id)}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
