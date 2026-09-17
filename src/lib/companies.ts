import type { CompanyBoard } from "./types";

export const SUGGESTED_COMPANIES = [
  "Shopify",
  "Stripe",
  "Databricks",
  "Cloudflare",
  "Notion",
  "Palantir",
  "Wealthsimple",
  "NVIDIA",
];

export const COMPANY_BOARDS: CompanyBoard[] = [
  { name: "Shopify", greenhouse: "shopify" },
  { name: "Stripe", greenhouse: "stripe" },
  { name: "Databricks", greenhouse: "databricks" },
  { name: "Cloudflare", greenhouse: "cloudflare" },
  { name: "Notion", greenhouse: "notion" },
  { name: "Figma", greenhouse: "figma" },
  { name: "Palantir", lever: "palantir" },
  { name: "Wealthsimple", greenhouse: "wealthsimple" },
  { name: "NVIDIA", greenhouse: "nvidia" },
  { name: "OpenAI", greenhouse: "openai" },
  { name: "Anthropic", greenhouse: "anthropic" },
  { name: "Vercel", greenhouse: "vercel" },
  { name: "Plaid", greenhouse: "plaid" },
  { name: "Ramp", greenhouse: "ramp" },
  { name: "Rippling", greenhouse: "rippling" },
  { name: "Discord", greenhouse: "discord" },
  { name: "Airbnb", greenhouse: "airbnb" },
  { name: "Coinbase", greenhouse: "coinbase" },
  { name: "DoorDash", greenhouse: "doordash" },
  { name: "Uber", greenhouse: "uber" },
  { name: "Dropbox", greenhouse: "dropbox" },
  { name: "Snowflake", greenhouse: "snowflake" },
  { name: "Asana", greenhouse: "asana" },
  { name: "Affirm", greenhouse: "affirm" },
  { name: "Instacart", greenhouse: "instacart" },
  { name: "Brex", greenhouse: "brex" },
  { name: "Faire", greenhouse: "faire" },
  { name: "Hopper", greenhouse: "hopper" },
  { name: "Scale AI", greenhouse: "scaleai" },
  { name: "Anduril", greenhouse: "anduril" },
];

export function normalizeCompany(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function findBoard(company: string): CompanyBoard {
  const key = company.trim().toLowerCase();
  const match = COMPANY_BOARDS.find((board) => board.name.toLowerCase() === key);
  if (match) return match;
  const slug = key.replace(/[^a-z0-9]+/g, "");
  return {
    name: normalizeCompany(company),
    greenhouse: slug || undefined,
  };
}

export function parseCompanyList(input: string) {
  const parts = input
    .split(/[\n,;]+/)
    .map(normalizeCompany)
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique;
}
