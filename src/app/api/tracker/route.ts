import { patchTrackerRow, readTracker } from "@/lib/tracker";
import { AGENT_POLICY } from "@/lib/policy";
import type { ApplicationStatus } from "@/lib/types";

export async function GET() {
  const rows = await readTracker();
  return Response.json({ rows, policy: AGENT_POLICY.rule });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    status?: ApplicationStatus;
    coverLetter?: string;
    humanNote?: string;
    confirmed?: boolean;
    confirmationText?: string;
  };

  if (!body.id) {
    return Response.json({ error: "Missing application id" }, { status: 400 });
  }

  if (body.status === "sent") {
    if (!body.confirmed) {
      return Response.json(
        {
          error:
            "Blocked: this agent never marks an application sent without a human checkbox.",
        },
        { status: 403 }
      );
    }
    const rows = await readTracker();
    const current = rows.find((row) => row.id === body.id);
    if (!current) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (current.status !== "approved") {
      return Response.json(
        { error: "Approve the cover letter before confirming you submitted it." },
        { status: 400 }
      );
    }
    const expected = current.company.trim().toLowerCase();
    if ((body.confirmationText || "").trim().toLowerCase() !== expected) {
      return Response.json(
        { error: `Type “${current.company}” to confirm you submitted this yourself.` },
        { status: 400 }
      );
    }
  }

  try {
    const row = await patchTrackerRow(body.id, {
      status: body.status,
      coverLetter: body.coverLetter,
      humanNote: body.humanNote,
      sentConfirmedAt: body.status === "sent" ? new Date().toISOString() : undefined,
    });
    return Response.json({ row });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 }
    );
  }
}
