import { readTracker, toCsv } from "@/lib/tracker";

export async function GET() {
  const rows = await readTracker();
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=coop-desk-tracker.csv",
    },
  });
}
