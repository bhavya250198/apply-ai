import { getCatalogJob, searchCatalog } from "./catalog";
import { findBoard } from "./companies";
import { snippet, stripHtml } from "./html";
import type { JobPosting } from "./types";

const STUDENT_TITLE =
  /\b(intern|internship|co-?op|co op|student|new grad|university|undergrad)\b/i;
const SENIOR_TITLE = /\b(senior|staff|principal|director|manager|lead)\b/i;

function isStudentRole(title: string) {
  if (STUDENT_TITLE.test(title)) return true;
  return false;
}

function shouldKeepTitle(title: string) {
  if (SENIOR_TITLE.test(title) && !STUDENT_TITLE.test(title)) return false;
  return isStudentRole(title);
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Co-op-Desk/1.0 (student application research agent)",
      },
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type GreenhouseList = {
  jobs: {
    id: number;
    title: string;
    absolute_url: string;
    location?: { name?: string };
    departments?: { name: string }[];
    updated_at?: string;
  }[];
};

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  departments?: { name: string }[];
  content?: string;
};

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  descriptionPlain?: string;
  description?: string;
  categories?: { location?: string; department?: string; commitment?: string };
};

function inferTerm(text: string) {
  const match = text.match(
    /\b((?:winter|summer|fall|spring|autumn)\s*20\d{2}|\d{1,2}\s*month(?:s)?(?:\s+term)?)\b/i
  );
  return match?.[1];
}

function fromGreenhouse(
  company: string,
  job: GreenhouseJob | GreenhouseList["jobs"][number],
  content = ""
): JobPosting {
  const description = stripHtml(content) || job.title;
  return {
    id: `greenhouse:${company.toLowerCase()}:${job.id}`,
    source: "greenhouse",
    company,
    title: job.title,
    location: job.location?.name || "Unlisted",
    url: job.absolute_url,
    department: job.departments?.[0]?.name,
    term: inferTerm(`${job.title}\n${description}`),
    description,
    snippet: snippet(description || job.title),
  };
}

function fromLever(company: string, posting: LeverPosting): JobPosting {
  const description = stripHtml(
    posting.descriptionPlain || posting.description || posting.text
  );
  return {
    id: `lever:${company.toLowerCase()}:${posting.id}`,
    source: "lever",
    company,
    title: posting.text,
    location: posting.categories?.location || "Unlisted",
    url: posting.hostedUrl,
    department: posting.categories?.department,
    term: inferTerm(`${posting.text}\n${description}`),
    description,
    snippet: snippet(description),
  };
}

async function searchGreenhouse(company: string, slug: string, limit: number) {
  const data = await fetchJson<GreenhouseList>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`
  );
  return (data.jobs || [])
    .filter((job) => shouldKeepTitle(job.title))
    .slice(0, limit)
    .map((job) => fromGreenhouse(company, job));
}

async function searchLever(company: string, slug: string, limit: number) {
  const data = await fetchJson<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`
  );
  return (data || [])
    .filter((job) => shouldKeepTitle(job.text))
    .slice(0, limit)
    .map((job) => fromLever(company, job));
}

export async function searchPostings(
  company: string,
  options: { limit?: number; mode?: "live-first" | "catalog" } = {}
) {
  const limit = options.limit ?? 4;
  const mode = options.mode ?? "live-first";
  const catalogHits = searchCatalog(company, limit);

  if (mode === "catalog") {
    return { jobs: catalogHits, sourceUsed: "catalog" as const, liveError: null as string | null };
  }

  const board = findBoard(company);
  const errors: string[] = [];

  if (board.greenhouse) {
    try {
      const jobs = await searchGreenhouse(company, board.greenhouse, limit);
      if (jobs.length) {
        return { jobs, sourceUsed: "greenhouse" as const, liveError: null };
      }
    } catch (error) {
      errors.push(`greenhouse:${error instanceof Error ? error.message : "error"}`);
    }
  }

  if (board.lever) {
    try {
      const jobs = await searchLever(company, board.lever, limit);
      if (jobs.length) {
        return { jobs, sourceUsed: "lever" as const, liveError: null };
      }
    } catch (error) {
      errors.push(`lever:${error instanceof Error ? error.message : "error"}`);
    }
  }

  return {
    jobs: catalogHits,
    sourceUsed: "catalog" as const,
    liveError: errors.join("; ") || (catalogHits.length ? "no live intern listings" : "no listings"),
  };
}

export async function fetchJob(id: string): Promise<JobPosting | null> {
  const catalog = getCatalogJob(id);
  if (catalog) return catalog;

  const greenhouse = id.match(/^greenhouse:([^:]+):(\d+)$/);
  if (greenhouse) {
    const [, company, jobId] = greenhouse;
    const board = findBoard(company);
    const slug = board.greenhouse || company;
    const data = await fetchJson<GreenhouseJob>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${jobId}`
    );
    return fromGreenhouse(board.name, data, data.content || "");
  }

  const lever = id.match(/^lever:([^:]+):(.+)$/);
  if (lever) {
    const [, company, jobId] = lever;
    const board = findBoard(company);
    const slug = board.lever || company;
    const data = await fetchJson<LeverPosting>(
      `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}/${encodeURIComponent(jobId)}`
    );
    return fromLever(board.name, data);
  }

  return null;
}
