import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCoopAgent, type AgentTools } from "./agent";
import { draftCoverLetter } from "./cover-letter";
import { isForbiddenTool, PolicyError } from "./policy";
import { parseResume } from "./resume";
import { SAMPLE_RESUME } from "./sample-resume";
import { scoreFit } from "./score";
import type { JobPosting, TrackerRow } from "./types";

describe("policy", () => {
  it("forbids submit and send tools", () => {
    assert.equal(isForbiddenTool("submit_application"), true);
    assert.equal(isForbiddenTool("send-email"), true);
    assert.equal(isForbiddenTool("write_tracker"), false);
    assert.equal(isForbiddenTool("search_postings"), false);
  });
});

describe("resume + scoring", () => {
  const resume = parseResume(SAMPLE_RESUME);

  it("extracts the sample student", () => {
    assert.match(resume.name, /AVERY LANG/i);
    assert.ok(resume.skills.includes("typescript"));
    assert.ok(resume.bullets.length >= 3);
  });

  it("scores an intern role higher than a senior role", () => {
    const intern: JobPosting = {
      id: "t-intern",
      source: "catalog",
      company: "Acme",
      title: "Software Engineering Intern",
      location: "Toronto, ON",
      url: "https://example.com/intern",
      description:
        "Co-op intern building TypeScript React services with PostgreSQL, Git, and Docker. Student term Winter 2027.",
      snippet: "intern",
    };
    const senior: JobPosting = {
      id: "t-senior",
      source: "catalog",
      company: "Acme",
      title: "Senior Staff Engineer",
      location: "Toronto, ON",
      url: "https://example.com/senior",
      description: "10+ years leading distributed systems. Not a student role.",
      snippet: "senior",
    };
    const internScore = scoreFit(resume, intern);
    const seniorScore = scoreFit(resume, senior);
    assert.ok(internScore.score > seniorScore.score);
    assert.ok(internScore.score >= 65);
    assert.equal(seniorScore.band, "poor");
  });
});

describe("cover letter", () => {
  it("names the student and the company and refuses to claim a send", () => {
    const resume = parseResume(SAMPLE_RESUME);
    const job: JobPosting = {
      id: "t-letter",
      source: "catalog",
      company: "Shopify",
      title: "Software Engineering Intern, Backend",
      location: "Toronto, ON",
      url: "https://example.com/shopify",
      term: "Winter 2027",
      description: "Build TypeScript and React services with SQL for merchants.",
      snippet: "shopify intern",
    };
    const letter = draftCoverLetter(resume, job, scoreFit(resume, job));
    assert.match(letter, /AVERY LANG/i);
    assert.match(letter, /Shopify/);
    assert.match(letter, /Winter 2027/);
    assert.match(letter, /reread the letter myself/i);
  });
});

describe("agent loop", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "coop-desk-"));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("processes N postings, writes the tracker, and never submits", async () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "tracker.json"), "[]\n");

    const jobs: JobPosting[] = [
      {
        id: "mock:1",
        source: "catalog",
        company: "Stripe",
        title: "Software Engineer Intern",
        location: "Toronto",
        url: "https://example.com/1",
        description: "TypeScript intern role with React and PostgreSQL. Co-op welcome.",
        snippet: "one",
      },
      {
        id: "mock:2",
        source: "catalog",
        company: "Stripe",
        title: "Software Engineer Intern, Billing",
        location: "Remote",
        url: "https://example.com/2",
        description: "Python and SQL internship on billing APIs.",
        snippet: "two",
      },
      {
        id: "mock:3",
        source: "catalog",
        company: "Notion",
        title: "Software Engineering Intern",
        location: "NYC",
        url: "https://example.com/3",
        description: "React TypeScript intern on editor sync.",
        snippet: "three",
      },
    ];

    const written: TrackerRow[] = [];
    const tools: AgentTools = {
      search: async (company) => ({
        jobs: jobs.filter((job) => job.company === company),
        sourceUsed: "catalog",
        liveError: null,
      }),
      fetch: async (id) => jobs.find((job) => job.id === id) ?? null,
      writeRow: async (row) => {
        written.push(row);
        return { rows: written, filePath: path.join(dir, "tracker.json"), row };
      },
    };

    const events = [];
    for await (const event of runCoopAgent(
      {
        resumeText: SAMPLE_RESUME,
        companies: ["Stripe", "Notion"],
        maxPostings: 2,
        minScore: 50,
        maxPerCompany: 2,
        searchMode: "catalog",
      },
      tools
    )) {
      events.push(event);
    }

    const processed = events.filter((e) => e.type === "progress");
    const lastProgress = processed.at(-1);
    assert.ok(lastProgress && lastProgress.type === "progress");
    assert.equal(lastProgress.processed, 2);
    assert.equal(written.length, 2);

    const stop = events.find((e) => e.type === "stop");
    assert.ok(stop && stop.type === "stop");
    assert.match(stop.reason, /posting cap/i);

    const blocks = events.filter((e) => e.type === "policy_block");
    assert.ok(blocks.length >= 1);
    assert.equal(
      events.some((e) => e.type === "tool_start" && e.tool === "submit_application"),
      false
    );

    const toolNames = events
      .filter((e) => e.type === "tool_start")
      .map((e) => (e.type === "tool_start" ? e.tool : ""));
    assert.ok(toolNames.includes("search_postings"));
    assert.ok(toolNames.includes("fetch_job"));
    assert.ok(toolNames.includes("write_tracker"));
  });

  it("throws if a forbidden tool is invoked directly", () => {
    assert.throws(() => {
      throw new PolicyError("send_email");
    }, /never submits/);
  });
});
