export type FitBand = "strong" | "good" | "stretch" | "poor";

export type ApplicationStatus =
  | "drafted"
  | "skipped"
  | "approved"
  | "rejected"
  | "sent";

export type JobSource = "greenhouse" | "lever" | "catalog";

export type JobPosting = {
  id: string;
  source: JobSource;
  company: string;
  title: string;
  location: string;
  url: string;
  department?: string;
  term?: string;
  description: string;
  snippet: string;
};

export type ResumeProfile = {
  name: string;
  email?: string;
  school?: string;
  program?: string;
  year?: string;
  location?: string;
  skills: string[];
  bullets: string[];
  projects: string[];
  raw: string;
};

export type FitScore = {
  score: number;
  band: FitBand;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  gaps: string[];
};

export type TrackerRow = {
  id: string;
  jobId: string;
  company: string;
  title: string;
  location: string;
  url: string;
  source: JobSource;
  term?: string;
  score: number;
  band: FitBand;
  status: ApplicationStatus;
  reasons: string[];
  gaps: string[];
  matchedSkills: string[];
  coverLetter: string;
  jobDescription: string;
  createdAt: string;
  updatedAt: string;
  humanNote?: string;
  sentConfirmedAt?: string;
};

export type AgentInput = {
  resumeText: string;
  companies: string[];
  maxPostings: number;
  minScore: number;
  maxPerCompany: number;
  searchMode: "live-first" | "catalog";
};

export type AgentEvent =
  | {
      type: "plan";
      goal: string;
      steps: string[];
      stopCondition: string;
      policy: string;
    }
  | { type: "thought"; text: string }
  | { type: "tool_start"; tool: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      tool: string;
      ok: boolean;
      summary: string;
      data?: unknown;
    }
  | { type: "policy_block"; tool: string; reason: string }
  | { type: "tracker_write"; row: TrackerRow }
  | { type: "progress"; processed: number; drafted: number; maxPostings: number }
  | { type: "stop"; reason: string }
  | {
      type: "done";
      processed: number;
      drafted: number;
      skipped: number;
      companiesTried: number;
    };

export type CompanyBoard = {
  name: string;
  greenhouse?: string;
  lever?: string;
};
