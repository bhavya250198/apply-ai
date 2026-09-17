import type { ResumeProfile } from "./types";

const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  "node.js": "node",
  nodejs: "node",
  ts: "typescript",
  "next.js": "next.js",
  nextjs: "next.js",
  reactjs: "react",
  postgres: "postgresql",
  "c++": "c++",
  cpp: "c++",
  golang: "go",
  k8s: "kubernetes",
  tf: "tensorflow",
  "gh actions": "github actions",
};

export const CANONICAL_SKILLS = [
  "typescript",
  "javascript",
  "python",
  "java",
  "c",
  "c++",
  "go",
  "rust",
  "sql",
  "html",
  "css",
  "react",
  "next.js",
  "node",
  "express",
  "flask",
  "django",
  "spring",
  "graphql",
  "rest",
  "grpc",
  "git",
  "docker",
  "kubernetes",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "linux",
  "aws",
  "gcp",
  "azure",
  "s3",
  "lambda",
  "github actions",
  "pytorch",
  "tensorflow",
  "pandas",
  "spark",
  "figma",
  "ruby",
  "rails",
  "scala",
  "swift",
  "kotlin",
];

function canonicalize(token: string) {
  const lower = token.toLowerCase().trim();
  return SKILL_ALIASES[lower] ?? lower;
}

function extractSkills(text: string) {
  const hay = text.toLowerCase();
  const found: string[] = [];
  for (const skill of CANONICAL_SKILLS) {
    const pattern =
      skill === "c"
        ? /(^|[^a-z])c([^a-z+]|$)/i
        : new RegExp(
            `(^|[^a-z0-9.+#])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9.+#]|$)`,
            "i"
          );
    if (pattern.test(hay) || hay.includes(canonicalize(skill))) {
      found.push(skill);
    }
  }
  return Array.from(new Set(found));
}

function displayName(value: string) {
  const cleaned = value.replace(/\s{2,}/g, " ").trim();
  if (cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
    return cleaned
      .toLowerCase()
      .replace(/\b([a-z])/g, (char) => char.toUpperCase());
  }
  return cleaned;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function bulletsFrom(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[•*\-–]/.test(line))
    .map((line) => line.replace(/^[•*\-–]\s*/, ""))
    .filter((line) => line.length > 24);
}

export function parseResume(raw: string): ResumeProfile {
  const text = raw.replace(/\r/g, "").trim();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const name = displayName(lines[0]?.split("·")[0]?.split("|")[0]?.trim() || "Applicant");

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const school = firstMatch(text, [
    /((?:University|College) of [A-Za-z .]+)/i,
    /((?:University|College)[^\n,—-]+)/i,
  ])?.replace(/\s{2,}/g, " ");
  const program = firstMatch(text, [
    /Bachelor of ([^\n,]+)/i,
    /B\.?S\.?c?\.? (?:in )?([^\n,]+)/i,
    /\b(Computer Science|Software Engineering|Computer Engineering)\b/i,
  ]);
  const year = firstMatch(text, [/\b(\d[A-B])\b/i, /(class of \d{4})/i]);
  const location = firstMatch(text, [
    /^[^\n]*?([A-Z][a-z]+,\s*(?:ON|BC|AB|QC|NS|CA|NY|WA|TX|MA))\b/m,
    /(Waterloo|Toronto|Vancouver|Montreal|New York|San Francisco|Seattle)/i,
  ]);

  const projectSection = text.split(/PROJECTS/i)[1]?.split(/AWARDS|EXPERIENCE/i)[0] ?? "";
  const projects = projectSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^[•*\-–]/.test(line) && line.length < 80)
    .slice(0, 6);

  const uniqueBullets = Array.from(new Set(bulletsFrom(text))).slice(0, 10);

  return {
    name,
    email,
    school,
    program,
    year,
    location,
    skills: extractSkills(text),
    bullets: uniqueBullets,
    projects,
    raw: text,
  };
}

export function extractSkillsFromText(text: string) {
  return extractSkills(text);
}

export function expandSkills(skills: string[]) {
  const set = new Set(skills.map((skill) => skill.toLowerCase()));
  if (set.has("typescript")) set.add("javascript");
  if (set.has("javascript")) set.add("typescript");
  if (set.has("react") || set.has("next.js") || set.has("node")) {
    set.add("javascript");
    set.add("typescript");
  }
  if (set.has("postgresql") || set.has("mysql")) set.add("sql");
  if (set.has("next.js")) set.add("react");
  return set;
}
