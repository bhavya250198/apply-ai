import { extractSkillsFromText } from "./resume";
import type { FitBand, FitScore, JobPosting, ResumeProfile } from "./types";

type Profile = ResumeProfile;

function bandFor(score: number): FitBand {
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "stretch";
  return "poor";
}

function hasStudentSignal(job: JobPosting) {
  if (/\b(intern|internship|co-?op|new grad)\b/i.test(job.title)) return true;
  return /\b(intern(?:ship)?|co-?op term|co-op student|student intern)\b/i.test(
    job.description
  );
}

function seniorPenalty(job: JobPosting) {
  const blob = `${job.title} ${job.description}`;
  if (/\b(intern|co-?op)\b/i.test(job.title)) return 0;
  if (/\b(senior|staff|principal|5\+ years|10\+ years)\b/i.test(blob)) return 42;
  return 0;
}

function locationBoost(resume: Profile, job: JobPosting) {
  const loc = (resume.location || resume.raw || "").toLowerCase();
  const jobLoc = job.location.toLowerCase();
  if (!loc) return 0;
  if (jobLoc.includes("remote")) return 4;
  const cities = ["waterloo", "toronto", "ottawa", "vancouver", "montreal"];
  for (const city of cities) {
    if (loc.includes(city) && jobLoc.includes(city)) return 8;
  }
  if (loc.includes("on") && /toronto|ottawa|canada/.test(jobLoc)) return 5;
  return 0;
}

export function scoreFit(resume: Profile, job: JobPosting): FitScore {
  const resumeSkills = new Set(resume.skills.map((s) => s.toLowerCase()));
  const jobSkills = extractSkillsFromText(`${job.title}\n${job.description}`);
  const matched = jobSkills.filter((skill) => resumeSkills.has(skill));
  const missing = jobSkills.filter((skill) => !resumeSkills.has(skill)).slice(0, 6);

  const skillScore =
    jobSkills.length === 0
      ? 40
      : Math.round((matched.length / Math.max(jobSkills.length, 1)) * 55);

  let score = 28 + skillScore;
  const reasons: string[] = [];
  const gaps: string[] = [];

  if (hasStudentSignal(job)) {
    score += 18;
    reasons.push("Role is explicitly intern / co-op / student.");
  } else {
    score -= 12;
    gaps.push("Posting is not clearly a student term.");
  }

  const penalty = seniorPenalty(job);
  if (penalty) {
    score -= penalty;
    gaps.push("Senior-level signals in the posting.");
  }

  const loc = locationBoost(resume, job);
  score += loc;
  if (loc >= 5) reasons.push(`Location lines up (${job.location}).`);

  if (matched.length) {
    reasons.push(
      `Resume already shows ${matched.slice(0, 5).join(", ")}${matched.length > 5 ? "…" : ""}.`
    );
  }

  const blob = job.description.toLowerCase();
  const evidenceHits = resume.bullets.filter((bullet) => {
    const words = bullet.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
    return words.filter((word) => blob.includes(word)).length >= 2;
  });
  if (evidenceHits.length) {
    score += Math.min(10, evidenceHits.length * 3);
    reasons.push("Project/internship bullets overlap the job’s language.");
  }

  if (/\b(react|typescript|node|postgres|api)\b/i.test(job.description) && resumeSkills.has("typescript")) {
    score += 4;
  }
  if (/\b(python|java|c\+\+|distributed|systems)\b/i.test(job.description) && (resumeSkills.has("python") || resumeSkills.has("c"))) {
    score += 3;
  }

  if (missing.length) {
    gaps.push(`JD mentions ${missing.join(", ")} and the resume does not.`);
  }

  score = Math.max(8, Math.min(96, Math.round(score)));

  if (!reasons.length) reasons.push("Generic student engineering role; limited overlap found.");

  return {
    score,
    band: bandFor(score),
    matchedSkills: matched,
    missingSkills: missing,
    reasons,
    gaps,
  };
}
