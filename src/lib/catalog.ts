import { snippet } from "./html";
import type { JobPosting } from "./types";

function job(
  company: string,
  slug: string,
  title: string,
  location: string,
  term: string,
  description: string,
  department?: string
): JobPosting {
  const id = `catalog:${company.toLowerCase().replace(/\s+/g, "-")}:${slug}`;
  return {
    id,
    source: "catalog",
    company,
    title,
    location,
    term,
    department,
    url: `https://example.com/jobs/${slug}`,
    description: description.trim(),
    snippet: snippet(description),
  };
}

const SHOPIFY_SWE = `
Software Engineering Intern, Backend — Winter 2027 (4 or 8 months)

Shopify is hiring co-op students to help merchants start, run, and grow a business. You will join a product team in Core or Shop Pay and ship production code used by millions of merchants.

What you’ll do
• Design and implement backend services in Ruby, TypeScript, or Go
• Ship GraphQL and REST APIs with tests, observability, and code review
• Partner with product and UX on experiments that move conversion
• Debug production issues with logs, metrics, and Postgres query plans

What you’ll need
• Enrollment in a computer science or related co-op program
• Experience with TypeScript or Python and at least one web framework (React, Node, Rails, Flask)
• Comfort with Git, SQL, and writing clear pull-request descriptions
• Curiosity about commerce, distributed systems, and merchant workflows

Nice to have: Redis, Docker, GraphQL, prior internships.

Locations: Toronto, Ottawa, or remote in Canada. This is a student intern / co-op role, not a senior posting.
`;

const SHOPIFY_FRONTEND = `
Frontend Engineering Intern — Summer 2027

Join the Admin experience team. You will build React interfaces that help merchants run their stores, with a focus on performance and accessibility.

Requirements
• Strong JavaScript/TypeScript and React
• CSS, HTML, and an eye for product polish
• Interest in GraphQL clients and design systems
• Currently a student available for a co-op / internship term

Toronto or remote Canada.
`;

const STRIPE_SWE = `
Software Engineer Intern, Payments — Summer 2027

Stripe internships are 12 weeks. You will own a project on the Payments or Billing platform: APIs, reliability, and developer experience.

Minimum qualifications
• CS fundamentals: data structures, algorithms, systems
• Ability to write production-quality code in Java, Ruby, Go, Python, or TypeScript
• Experience with SQL, Git, and testing
• Pursuing a bachelor’s degree; available for a summer internship

Preferred: internships building APIs, familiarity with webhooks, Postgres, Redis, or distributed systems.

Locations: South San Francisco, Seattle, NYC, Toronto, or remote (US/Canada).
`;

const DATABRICKS_SWE = `
Software Engineering Intern — Data Platform

Work on Spark, Delta Lake, or the Databricks workspace. Interns write production code, participate in design reviews, and present their project at the end of the term.

Looking for
• Python, Java, or Scala
• Interest in distributed systems, query engines, or developer tools
• SQL and Linux comfort
• Student pursuing CS / software engineering, internship or co-op term

Mountain View, San Francisco, Bellevue, or Toronto.
`;

const DATABRICKS_ML = `
Machine Learning Intern — Research-adjacent product

Help ship applied ML features: retrieval, ranking, or assistant tooling on top of notebooks.

Requirements: Python, PyTorch or TensorFlow, pandas, and a statistical ML course. Prior research is a plus. This is an intern role.

San Francisco / Mountain View.
`;

const CLOUDFLARE_SWE = `
Software Engineer Intern — Workers / Application Services

Cloudflare interns join a team for the summer or a co-op term and ship to a global edge network.

You should have
• Systems interest: networking, Linux, performance
• One of: Go, Rust, TypeScript, C, or Python
• Git, testing, and curiosity about the public internet
• Enrollment in a degree program; internship/co-op availability

Austin, San Francisco, or remote US/Canada.
`;

const NOTION_SWE = `
Software Engineering Intern — Editor & Sync

Build product features in TypeScript, React, and Node. You will work on sync, permissions, or editor performance.

Qualifications
• TypeScript and React
• Interest in local-first software, CRDTs, or product engineering
• SQL or Postgres experience is helpful
• Student intern for summer or a co-op term

San Francisco or New York. Hybrid.
`;

const PALANTIR_SWE = `
Software Engineer Intern — Foundry

Interns at Palantir work with customers and engineers to ship Foundry or Apollo features. Expect Java, TypeScript, and a lot of product judgment.

Requirements
• Strong coding ability (Java, Python, or TypeScript)
• Ability to learn ambiguous problem spaces quickly
• Interest in data platforms, security, or operational workflows
• University student available for an internship

NYC, Palo Alto, Washington DC, or London.
`;

const WEALTHSIMPLE_SWE = `
Full-Stack Engineering Intern — Winter 2027 Co-op

Wealthsimple is hiring Canadian co-op students to work on money products used by millions. You will ship TypeScript, React, and Node services with a product squad.

Must-haves
• Currently enrolled in a Canadian university co-op program
• Experience with JavaScript/TypeScript and React or similar
• SQL, Git, and a bias toward tested, readable code
• Interest in fintech, reliability, and consumer product

Nice to have: Python, AWS, previous internships, GraphQL.

Toronto (hybrid). 4 or 8 month term.
`;

const NVIDIA_SWE = `
Software Intern — CUDA / Developer Tools

Work on tooling, compilers, or developer experience around accelerated computing.

Looking for
• C, C++, or Python
• CS systems coursework (OS, compilers, or architecture)
• Linux and Git
• Student internship for summer 2027

Santa Clara, Austin, or remote (limited).
`;

const NVIDIA_SYS = `
Systems Software Intern — GPU Infrastructure

Build services that schedule and observe GPU clusters. Go, Python, Kubernetes, and Linux. Intern / co-op only.

Santa Clara.
`;

const RBC_SWE = `
Technology Co-op — Amplify / Capital Markets Technology

RBC hires multi-term co-op students in Toronto. You will work on internal platforms: Java or TypeScript services, SQL databases, and secure software delivery.

Requirements
• Canadian student eligible for a co-op work term
• Java, Python, or JavaScript
• Understanding of data structures and Git
• Interest in banking technology, not a senior developer role

Toronto. Winter or summer 2027.
`;

export const JOB_CATALOG: JobPosting[] = [
  job("Shopify", "winter-2027-backend", "Software Engineering Intern, Backend", "Toronto, ON (hybrid / remote Canada)", "Winter 2027", SHOPIFY_SWE, "Engineering"),
  job("Shopify", "summer-2027-frontend", "Frontend Engineering Intern", "Toronto, ON", "Summer 2027", SHOPIFY_FRONTEND, "Engineering"),
  job("Stripe", "summer-2027-payments", "Software Engineer Intern, Payments", "Toronto / SF / Remote US-Canada", "Summer 2027", STRIPE_SWE, "Payments"),
  job("Databricks", "intern-data-platform", "Software Engineering Intern, Data Platform", "Toronto / Bay Area", "Summer 2027", DATABRICKS_SWE, "Engineering"),
  job("Databricks", "intern-ml", "Machine Learning Intern", "San Francisco, CA", "Summer 2027", DATABRICKS_ML, "ML"),
  job("Cloudflare", "intern-workers", "Software Engineer Intern, Workers", "Remote US/Canada", "Summer 2027", CLOUDFLARE_SWE, "Application Services"),
  job("Notion", "intern-editor", "Software Engineering Intern, Editor & Sync", "San Francisco / New York", "Summer 2027", NOTION_SWE, "Product Engineering"),
  job("Palantir", "intern-foundry", "Software Engineer Intern, Foundry", "New York, NY", "Summer 2027", PALANTIR_SWE, "Foundry"),
  job("Wealthsimple", "winter-2027-fullstack", "Full-Stack Engineering Intern (Co-op)", "Toronto, ON", "Winter 2027", WEALTHSIMPLE_SWE, "Engineering"),
  job("NVIDIA", "intern-cuda", "Software Intern, CUDA Developer Tools", "Santa Clara, CA", "Summer 2027", NVIDIA_SWE, "Developer Tools"),
  job("NVIDIA", "intern-systems", "Systems Software Intern, GPU Infrastructure", "Santa Clara, CA", "Summer 2027", NVIDIA_SYS, "Infrastructure"),
  job("RBC", "coop-amplify", "Technology Co-op, Capital Markets", "Toronto, ON", "Winter 2027", RBC_SWE, "Technology"),
];

export function searchCatalog(company: string, limit = 6): JobPosting[] {
  const key = company.trim().toLowerCase();
  const exact = JOB_CATALOG.filter((job) => job.company.toLowerCase() === key);
  if (exact.length) return exact.slice(0, limit);
  const loose = JOB_CATALOG.filter(
    (job) =>
      job.company.toLowerCase().includes(key) ||
      key.includes(job.company.toLowerCase())
  );
  return loose.slice(0, limit);
}

export function getCatalogJob(id: string) {
  return JOB_CATALOG.find((job) => job.id === id);
}
