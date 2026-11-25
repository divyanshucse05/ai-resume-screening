const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  getHealth: () => request("/api/health"),

  getJobs: () => request("/api/jobs"),
  createJob: (payload) =>
    request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteJob: (id) =>
    request(`/api/jobs/${id}`, {
      method: "DELETE",
    }),

  getCandidates: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });
    const qs = query.toString();
    return request(`/api/candidates${qs ? `?${qs}` : ""}`);
  },

  screenResumes: ({ jobId, files, resumeText, name, email }) => {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append("jobId", jobId);
      for (const file of files) {
        formData.append("resumes", file);
      }
      return request("/api/candidates/screen", {
        method: "POST",
        body: formData,
      });
    }

    return request("/api/candidates/screen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, resumeText, name, email }),
    });
  },

  autoShortlist: (payload) =>
    request("/api/candidates/shortlist/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  updateCandidateStatus: (id, status) =>
    request(`/api/candidates/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),

  deleteCandidate: (id) =>
    request(`/api/candidates/${id}`, {
      method: "DELETE",
    }),
};
