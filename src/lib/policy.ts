export const AGENT_POLICY = {
  name: "human-in-the-loop",
  rule: "Never submit, email, or POST an application. Search, fetch, score, draft, and write the tracker only. A human must approve the letter and submit on the company site.",
  forbiddenTools: [
    "submit_application",
    "send_email",
    "post_application",
    "apply",
    "send",
  ],
  why: [
    "A co-op application is high-stakes and usually irreversible. Auto-submit can burn a company relationship on the wrong role, term, or work-authorization answer.",
    "Fit scores miss nuance a student knows: overlapping interviews, course load, visa constraints, and whether they actually want the team.",
    "Cover letters should sound like the applicant. The agent drafts; the student owns every claim before it leaves the desk.",
    "Being able to explain a human gate is itself the interview answer: tools do the grind, people take responsibility.",
  ],
} as const;

export function isForbiddenTool(name: string) {
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (AGENT_POLICY.forbiddenTools as readonly string[]).includes(key);
}

export class PolicyError extends Error {
  tool: string;

  constructor(tool: string) {
    super(
      `Blocked ${tool}: this agent never submits without explicit human confirmation.`
    );
    this.name = "PolicyError";
    this.tool = tool;
  }
}
