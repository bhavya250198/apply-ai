import { runCoopAgent } from "@/lib/agent";
import type { AgentInput } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: AgentInput;
  try {
    body = (await request.json()) as AgentInput;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.resumeText?.trim()) {
    return Response.json({ error: "Resume is required" }, { status: 400 });
  }
  if (!body.companies?.length) {
    return Response.json({ error: "Add at least one company" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runCoopAgent({
          resumeText: body.resumeText,
          companies: body.companies,
          maxPostings: body.maxPostings ?? 8,
          minScore: body.minScore ?? 55,
          maxPerCompany: body.maxPerCompany ?? 2,
          searchMode: body.searchMode ?? "live-first",
        })) {
          if (request.signal.aborted) break;
          send(event);
        }
      } catch (error) {
        send({
          type: "stop",
          reason: error instanceof Error ? error.message : "Agent failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
