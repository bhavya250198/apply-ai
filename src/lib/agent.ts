import { draftCoverLetter } from "./cover-letter";
import { AGENT_POLICY, PolicyError, isForbiddenTool } from "./policy";
import { parseResume } from "./resume";
import { scoreFit } from "./score";
import { fetchJob, searchPostings } from "./search";
import { upsertTrackerRow } from "./tracker";
import type {
  AgentEvent,
  AgentInput,
  JobPosting,
  ResumeProfile,
  TrackerRow,
} from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AgentTools = {
  search: typeof searchPostings;
  fetch: typeof fetchJob;
  writeRow: typeof upsertTrackerRow;
};

export const defaultTools: AgentTools = {
  search: searchPostings,
  fetch: fetchJob,
  writeRow: upsertTrackerRow,
};

function callTool(name: string) {
  if (isForbiddenTool(name)) {
    throw new PolicyError(name);
  }
}

export async function* runCoopAgent(
  input: AgentInput,
  tools: AgentTools = defaultTools
): AsyncGenerator<AgentEvent> {
  const maxPostings = Math.max(1, Math.min(input.maxPostings, 20));
  const minScore = Math.max(0, Math.min(input.minScore, 100));
  const maxPerCompany = Math.max(1, Math.min(input.maxPerCompany, 5));
  const companies = input.companies.map((c) => c.trim()).filter(Boolean);

  const steps = [
    "Parse the resume into skills, experience, and term availability",
    `Search intern / co-op postings at ${companies.length} target companies`,
    "Fetch each job description",
    "Score fit against the resume",
    `Draft a cover letter when score ≥ ${minScore}`,
    "Write every considered posting to the tracker file",
    "Stop. Never submit — wait for human approval",
  ];

  yield {
    type: "plan",
    goal: "Fill a co-op tracker with scored postings and drafted letters. Do not apply.",
    steps,
    stopCondition: `Stop after ${maxPostings} postings are processed, or after every company is searched — whichever comes first.`,
    policy: AGENT_POLICY.rule,
  };

  yield {
    type: "thought",
    text: "Human-in-the-loop is on: I can search, fetch, score, draft, and file-write. Submit/email tools are forbidden.",
  };

  const resume: ResumeProfile = parseResume(input.resumeText);
  yield {
    type: "tool_result",
    tool: "parse_resume",
    ok: true,
    summary: `${resume.name} · ${resume.skills.length} skills · ${resume.bullets.length} bullets`,
    data: {
      name: resume.name,
      skills: resume.skills,
      school: resume.school,
    },
  };

  let processed = 0;
  let drafted = 0;
  let skipped = 0;
  let companiesTried = 0;
  let stopReason = "";

  companyLoop: for (const company of companies) {
    if (processed >= maxPostings) {
      stopReason = `Reached the posting cap (${maxPostings}).`;
      break;
    }

    companiesTried += 1;
    yield {
      type: "thought",
      text: `Plan step: search ${company} for intern / co-op roles (max ${maxPerCompany} this company).`,
    };

    yield {
      type: "tool_start",
      tool: "search_postings",
      args: { company, query: "intern OR co-op", mode: input.searchMode },
    };

    let jobs: JobPosting[] = [];
    try {
      callTool("search_postings");
      const result = await tools.search(company, {
        limit: maxPerCompany,
        mode: input.searchMode,
      });
      jobs = result.jobs.slice(0, maxPerCompany);
      yield {
        type: "tool_result",
        tool: "search_postings",
        ok: true,
        summary: `${jobs.length} student roles via ${result.sourceUsed}${result.liveError ? ` (live: ${result.liveError})` : ""}`,
        data: {
          sourceUsed: result.sourceUsed,
          titles: jobs.map((job) => job.title),
        },
      };
    } catch (error) {
      yield {
        type: "tool_result",
        tool: "search_postings",
        ok: false,
        summary: error instanceof Error ? error.message : "Search failed",
      };
      continue;
    }

    if (!jobs.length) {
      yield {
        type: "thought",
        text: `No intern/co-op postings found for ${company}. Moving on.`,
      };
      continue;
    }

    for (const listing of jobs) {
      if (processed >= maxPostings) {
        stopReason = `Reached the posting cap (${maxPostings}).`;
        break companyLoop;
      }

      yield {
        type: "tool_start",
        tool: "fetch_job",
        args: { id: listing.id, title: listing.title },
      };

      let job: JobPosting | null = listing;
      try {
        callTool("fetch_job");
        job = (await tools.fetch(listing.id)) ?? listing;
        if (!job.description || job.description === job.title) {
          job = { ...listing, ...job, description: listing.description || job.description };
        }
        yield {
          type: "tool_result",
          tool: "fetch_job",
          ok: true,
          summary: `${job.title} · ${job.location} · ${job.description.split(/\s+/).length} words`,
        };
      } catch (error) {
        yield {
          type: "tool_result",
          tool: "fetch_job",
          ok: false,
          summary: error instanceof Error ? error.message : "Fetch failed",
        };
        job = listing;
      }

      if (!job) continue;

      yield {
        type: "tool_start",
        tool: "score_fit",
        args: { jobId: job.id, company: job.company },
      };
      const fit = scoreFit(resume, job);
      yield {
        type: "tool_result",
        tool: "score_fit",
        ok: true,
        summary: `${fit.score}/100 ${fit.band} · ${fit.matchedSkills.slice(0, 4).join(", ") || "no stacked overlap"}`,
        data: fit,
      };

      let coverLetter = "";
      let status: TrackerRow["status"] = "skipped";
      if (fit.score >= minScore) {
        yield {
          type: "tool_start",
          tool: "draft_cover_letter",
          args: { jobId: job.id, name: resume.name },
        };
        coverLetter = draftCoverLetter(resume, job, fit);
        status = "drafted";
        drafted += 1;
        yield {
          type: "tool_result",
          tool: "draft_cover_letter",
          ok: true,
          summary: `Drafted ${coverLetter.split(/\s+/).length}-word letter. Not sent.`,
        };
      } else {
        skipped += 1;
        yield {
          type: "thought",
          text: `Score ${fit.score} is below the ${minScore} bar. Logging it as skipped — still no submit.`,
        };
      }

      const now = new Date().toISOString();
      const row: TrackerRow = {
        id: job.id,
        jobId: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        url: job.url,
        source: job.source,
        term: job.term,
        score: fit.score,
        band: fit.band,
        status,
        reasons: fit.reasons,
        gaps: fit.gaps,
        matchedSkills: fit.matchedSkills,
        coverLetter,
        jobDescription: job.description,
        createdAt: now,
        updatedAt: now,
      };

      yield {
        type: "tool_start",
        tool: "write_tracker",
        args: { file: "data/tracker.json", company: row.company, status: row.status },
      };
      try {
        callTool("write_tracker");
        callTool("submit_application");
      } catch (error) {
        if (error instanceof PolicyError && error.tool === "submit_application") {
          yield {
            type: "policy_block",
            tool: "submit_application",
            reason: error.message,
          };
        } else {
          throw error;
        }
      }

      try {
        const written = await tools.writeRow(row);
        yield {
          type: "tool_result",
          tool: "write_tracker",
          ok: true,
          summary: `Wrote ${row.company} · ${row.title} as ${row.status}`,
        };
        yield { type: "tracker_write", row: written.row };
      } catch (error) {
        yield {
          type: "tool_result",
          tool: "write_tracker",
          ok: false,
          summary: error instanceof Error ? error.message : "Write failed",
        };
      }

      processed += 1;
      yield {
        type: "progress",
        processed,
        drafted,
        maxPostings,
      };
      await sleep(60);
    }
  }

  if (!stopReason) {
    stopReason =
      companiesTried >= companies.length
        ? "Searched every target company."
        : "Nothing left in the queue.";
  }

  yield { type: "stop", reason: stopReason };
  yield {
    type: "done",
    processed,
    drafted,
    skipped,
    companiesTried,
  };
}
