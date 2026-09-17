import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApplicationStatus, TrackerRow } from "./types";

const TRACKER_DIR = path.join(process.cwd(), "data");
const TRACKER_PATH = path.join(TRACKER_DIR, "tracker.json");

async function ensureFile() {
  await mkdir(TRACKER_DIR, { recursive: true });
  try {
    await readFile(TRACKER_PATH, "utf8");
  } catch {
    await writeFile(TRACKER_PATH, "[]\n", "utf8");
  }
}

export async function readTracker(): Promise<TrackerRow[]> {
  await ensureFile();
  const raw = await readFile(TRACKER_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as TrackerRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeTrackerRows(rows: TrackerRow[]) {
  await ensureFile();
  await writeFile(TRACKER_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  return TRACKER_PATH;
}

export async function upsertTrackerRow(row: TrackerRow) {
  const rows = await readTracker();
  const index = rows.findIndex((item) => item.id === row.id || item.jobId === row.jobId);
  if (index >= 0) {
    rows[index] = { ...rows[index], ...row, updatedAt: new Date().toISOString() };
  } else {
    rows.unshift(row);
  }
  const filePath = await writeTrackerRows(rows);
  return { rows, filePath, row: rows[index >= 0 ? index : 0] };
}

export async function patchTrackerRow(
  id: string,
  patch: Partial<Pick<TrackerRow, "status" | "coverLetter" | "humanNote" | "sentConfirmedAt">>
) {
  const rows = await readTracker();
  const index = rows.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("Application not found");

  const current = rows[index];
  if (patch.status === "sent" && current.status !== "approved" && current.status !== "sent") {
    throw new Error("Cannot mark sent until the cover letter is approved.");
  }

  rows[index] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeTrackerRows(rows);
  return rows[index];
}

export function toCsv(rows: TrackerRow[]) {
  const headers = [
    "company",
    "title",
    "location",
    "term",
    "score",
    "band",
    "status",
    "url",
    "matched_skills",
    "updated_at",
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.company,
        row.title,
        row.location,
        row.term || "",
        String(row.score),
        row.band,
        row.status,
        row.url,
        row.matchedSkills.join("; "),
        row.updatedAt,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export const trackerFilePath = TRACKER_PATH;

export function assertHumanSend(status: ApplicationStatus, confirmed: boolean) {
  if (!confirmed) {
    throw new Error("Human confirmation is required before marking an application sent.");
  }
  if (status !== "approved") {
    throw new Error("Approve the letter before confirming a send.");
  }
}
