import type { FitScore, JobPosting, ResumeProfile } from "./types";

function firstSentence(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/(.+?[.!?])\s/);
  return (match?.[1] || clean).slice(0, 220);
}

function pickBullets(resume: ResumeProfile, job: JobPosting, count = 2) {
  const hay = `${job.title} ${job.description}`.toLowerCase();
  const ranked = [...resume.bullets].sort((a, b) => {
    const score = (bullet: string) =>
      bullet
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 4 && hay.includes(word)).length;
    return score(b) - score(a);
  });
  const chosen = ranked.slice(0, count);
  if (chosen.length < count) {
    return [...chosen, ...resume.projects.map((p) => `Built ${p}`)].slice(0, count);
  }
  return chosen;
}

function availability(resume: ResumeProfile, job: JobPosting) {
  if (job.term) return job.term;
  const fromResume = resume.raw.match(/\b((?:winter|summer|fall|spring)\s*20\d{2})\b/i);
  if (fromResume) return fromResume[1];
  return "the upcoming co-op term";
}

function greeting(company: string) {
  return `Dear ${company} hiring team,`;
}

export function draftCoverLetter(
  resume: ResumeProfile,
  job: JobPosting,
  fit: FitScore
) {
  const bullets = pickBullets(resume, job);
  const skills = (fit.matchedSkills.length ? fit.matchedSkills : resume.skills)
    .slice(0, 6)
    .join(", ");
  const school = resume.school || "my university";
  const program = resume.program || "Computer Science";
  const year = resume.year ? `, ${resume.year}` : "";
  const hook = firstSentence(job.description);
  const productCue = job.department ? ` on ${job.department}` : "";
  const whyCompany = hook.startsWith(job.title)
    ? `I want to spend a term${productCue} because the work is a close match for the systems and product engineering I already practice.`
    : `I was drawn to this posting in particular: ${hook}`;

  const evidence = bullets
    .map((bullet, index) => {
      const lead =
        index === 0
          ? "In a recent internship / project, "
          : "Separately, ";
      const trimmed = bullet.replace(/\.$/, "");
      return `${lead}${trimmed[0]?.toLowerCase()}${trimmed.slice(1)}.`;
    })
    .join(" ");

  const gapLine =
    fit.missingSkills.length > 0
      ? ` I do not yet list ${fit.missingSkills.slice(0, 2).join(" and ")} as production skills, so I would treat the first weeks as a structured ramp rather than inventing experience I do not have.`
      : "";

  const location = job.location.includes("Unlisted")
    ? ""
    : ` I am targeting ${job.location}.`;

  return `${greeting(job.company)}

I am ${resume.name}, a ${program} student at ${school}${year}, applying for ${job.title}. ${whyCompany}

${evidence} Those are the same muscles this role asks for: shipping with ${skills || "the stack on the posting"}, writing tests, and explaining tradeoffs in review.

I am available for ${availability(resume, job)}.${location}${gapLine} I would like to contribute as a co-op intern and I will only submit this application after I have reread the letter myself.

Thank you for your time.

Sincerely,
${resume.name}`;
}
