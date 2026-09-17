"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Check,
  CircleStop,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  Plus,
  ShieldAlert,
  Stamp,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SUGGESTED_COMPANIES } from "@/lib/companies";
import { AGENT_POLICY } from "@/lib/policy";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import type { AgentEvent, ApplicationStatus, TrackerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type LogItem = AgentEvent & { at: string };

const DEFAULT_COMPANIES = [...SUGGESTED_COMPANIES];

function statusStyle(status: ApplicationStatus) {
  switch (status) {
    case "drafted":
      return "bg-[oklch(0.93_0.05_70)] text-[oklch(0.4_0.12_40)]";
    case "approved":
      return "bg-[oklch(0.93_0.04_155)] text-[oklch(0.32_0.08_155)]";
    case "sent":
      return "bg-[oklch(0.9_0.03_248)] text-[oklch(0.32_0.08_248)]";
    case "rejected":
    case "skipped":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted";
  }
}

function bandStyle(band: TrackerRow["band"]) {
  if (band === "strong") return "text-[oklch(0.36_0.09_155)]";
  if (band === "good") return "text-[oklch(0.38_0.08_248)]";
  if (band === "stretch") return "text-[oklch(0.45_0.12_55)]";
  return "text-muted-foreground";
}

async function readSse(
  response: Response,
  onEvent: (event: AgentEvent) => void
) {
  if (!response.body) throw new Error("No stream from agent");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .filter((part) => part.startsWith("data:"))
        .map((part) => part.slice(5).trim())
        .join("");
      if (!line) continue;
      onEvent(JSON.parse(line) as AgentEvent);
    }
  }
}

export function DeskApp() {
  const [resumeText, setResumeText] = useState(SAMPLE_RESUME);
  const [companies, setCompanies] = useState<string[]>(DEFAULT_COMPANIES);
  const [companyDraft, setCompanyDraft] = useState("");
  const [maxPostings, setMaxPostings] = useState(8);
  const [minScore, setMinScore] = useState(55);
  const [maxPerCompany, setMaxPerCompany] = useState(2);
  const [searchMode, setSearchMode] = useState<"live-first" | "catalog">(
    "live-first"
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [plan, setPlan] = useState<Extract<AgentEvent, { type: "plan" }> | null>(
    null
  );
  const [progress, setProgress] = useState({ processed: 0, drafted: 0, max: 8 });
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [letterDraft, setLetterDraft] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState("brief");
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    fetch("/api/tracker")
      .then((res) => res.json())
      .then((data: { rows: TrackerRow[] }) => setRows(data.rows ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const openRow = (id: string) => {
    const row = rows.find((item) => item.id === id);
    setSelectedId(id);
    setLetterDraft(row?.coverLetter ?? "");
    setMobileTab("tracker");
  };

  const addCompany = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCompanies((current) =>
      current.some((item) => item.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [...current, trimmed]
    );
    setCompanyDraft("");
  };

  const pushLog = (event: AgentEvent) => {
    setLog((current) => [
      ...current,
      { ...event, at: new Date().toLocaleTimeString() },
    ]);
    if (event.type === "plan") setPlan(event);
    if (event.type === "progress") {
      setProgress({
        processed: event.processed,
        drafted: event.drafted,
        max: event.maxPostings,
      });
    }
    if (event.type === "stop") setStopReason(event.reason);
    if (event.type === "tracker_write") {
      setRows((current) => {
        const next = current.filter((row) => row.id !== event.row.id);
        return [event.row, ...next];
      });
    }
  };

  const runAgent = async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setRunning(true);
    setError(null);
    setLog([]);
    setPlan(null);
    setStopReason(null);
    setProgress({ processed: 0, drafted: 0, max: maxPostings });
    setMobileTab("agent");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          resumeText,
          companies,
          maxPostings,
          minScore,
          maxPerCompany,
          searchMode,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Agent failed to start");
      }
      await readSse(response, pushLog);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Run failed");
      }
    } finally {
      setRunning(false);
    }
  };

  const patchRow = async (
    id: string,
    patch: Record<string, unknown>
  ): Promise<TrackerRow | null> => {
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const payload = (await response.json()) as {
      row?: TrackerRow;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "Update failed");
    }
    if (payload.row) {
      setRows((current) =>
        current.map((row) => (row.id === payload.row!.id ? payload.row! : row))
      );
      return payload.row;
    }
    return null;
  };

  const onFile = async (file: File) => {
    if (!file.type.startsWith("text") && !file.name.match(/\.(txt|md)$/i)) {
      setError("Paste the resume or upload a .txt / .md file. PDFs need a copy-paste.");
      return;
    }
    setResumeText(await file.text());
  };

  const awaiting = rows.filter((row) => row.status === "drafted").length;
  const approved = rows.filter((row) => row.status === "approved").length;

  const planDone = useMemo(() => {
    const tools = log.filter((item) => item.type === "tool_result").length;
    return tools;
  }, [log]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-[oklch(0.82_0.03_80)] bg-[oklch(0.28_0.045_248)] text-[oklch(0.97_0.015_90)]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[oklch(0.82_0.04_80)] uppercase">
              Human-in-the-loop · never auto-submits
            </p>
            <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">
              Co-op Desk
            </h1>
            <p className="mt-1 max-w-xl text-sm text-[oklch(0.86_0.02_90)]">
              Give it a resume and target companies. It searches postings, pulls
              each JD, scores fit, drafts a letter, and files the tracker. You
              send.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[oklch(0.52_0.16_32)] text-white">
              {awaiting} awaiting you
            </Badge>
            <Badge className="bg-[oklch(0.42_0.08_155)] text-white">
              {approved} approved
            </Badge>
            <Badge variant="outline" className="border-white/30 text-white">
              {rows.length} in tracker
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-5">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:hidden">
          {(["brief", "agent", "tracker"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm capitalize",
                mobileTab === tab ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <section
          className={cn(
            "flex flex-col gap-4",
            mobileTab !== "brief" && "max-lg:hidden"
          )}
        >
          <BriefPanel
            resumeText={resumeText}
            setResumeText={setResumeText}
            onFile={onFile}
            companies={companies}
            setCompanies={setCompanies}
            companyDraft={companyDraft}
            setCompanyDraft={setCompanyDraft}
            addCompany={addCompany}
            maxPostings={maxPostings}
            setMaxPostings={setMaxPostings}
            minScore={minScore}
            setMinScore={setMinScore}
            maxPerCompany={maxPerCompany}
            setMaxPerCompany={setMaxPerCompany}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            running={running}
            runAgent={runAgent}
            stop={() => abortRef.current?.abort()}
          />
        </section>

        <section
          className={cn(
            "flex min-h-[520px] flex-col",
            mobileTab !== "agent" && "max-lg:hidden"
          )}
        >
          <AgentConsole
            plan={plan}
            log={log}
            running={running}
            progress={progress}
            stopReason={stopReason}
            error={error}
            planDone={planDone}
            logEndRef={logEndRef}
          />
        </section>

        <section
          className={cn(
            "flex min-h-[520px] flex-col",
            mobileTab !== "tracker" && "max-lg:hidden"
          )}
        >
          <TrackerPanel
            rows={rows}
            selectedId={selectedId}
            onSelect={openRow}
          />
        </section>
      </main>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl"
        >
          {selected && (
            <ApplicationReview
              row={selected}
              letterDraft={letterDraft}
              setLetterDraft={setLetterDraft}
              onApprove={async () => {
                await patchRow(selected.id, {
                  status: "approved",
                  coverLetter: letterDraft,
                });
              }}
              onReject={async () => {
                await patchRow(selected.id, { status: "rejected" });
                setSelectedId(null);
              }}
              onSaveLetter={async () => {
                await patchRow(selected.id, { coverLetter: letterDraft });
              }}
              onRequestSend={() => {
                setConfirmName("");
                setConfirmCheck(false);
                setSendError(null);
                setSendOpen(true);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              You submit. The agent does not.
            </DialogTitle>
            <DialogDescription>
              This is the human gate. Auto-send would be easier to demo and
              worse in real life: wrong term, wrong work-auth answer, or a
              letter that does not sound like you.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {AGENT_POLICY.why.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              checked={confirmCheck}
              onCheckedChange={(value) => setConfirmCheck(Boolean(value))}
              id="human-submit"
            />
            <Label htmlFor="human-submit" className="text-sm font-normal leading-5">
              I submitted this posting myself on the company site. Co-op Desk
              only updates the tracker.
            </Label>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-company">Type {selected?.company} to confirm</Label>
            <Input
              id="confirm-company"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={selected?.company}
            />
          </div>
          {sendError && (
            <p className="text-sm text-destructive">{sendError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected || !confirmCheck}
              onClick={async () => {
                if (!selected) return;
                try {
                  await patchRow(selected.id, {
                    status: "sent",
                    confirmed: true,
                    confirmationText: confirmName,
                    coverLetter: letterDraft,
                  });
                  setSendOpen(false);
                } catch (err) {
                  setSendError(err instanceof Error ? err.message : "Blocked");
                }
              }}
            >
              Confirm I sent it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BriefPanel({
  resumeText,
  setResumeText,
  onFile,
  companies,
  setCompanies,
  companyDraft,
  setCompanyDraft,
  addCompany,
  maxPostings,
  setMaxPostings,
  minScore,
  setMinScore,
  maxPerCompany,
  setMaxPerCompany,
  searchMode,
  setSearchMode,
  running,
  runAgent,
  stop,
}: {
  resumeText: string;
  setResumeText: (value: string) => void;
  onFile: (file: File) => void;
  companies: string[];
  setCompanies: (value: string[] | ((current: string[]) => string[])) => void;
  companyDraft: string;
  setCompanyDraft: (value: string) => void;
  addCompany: (name: string) => void;
  maxPostings: number;
  setMaxPostings: (value: number) => void;
  minScore: number;
  setMinScore: (value: number) => void;
  maxPerCompany: number;
  setMaxPerCompany: (value: number) => void;
  searchMode: "live-first" | "catalog";
  setSearchMode: (value: "live-first" | "catalog") => void;
  running: boolean;
  runAgent: () => void;
  stop: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg">Brief</h2>
            <p className="text-xs text-muted-foreground">
              Resume in, companies in. The agent never emails from here.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResumeText(SAMPLE_RESUME)}
          >
            Load sample
          </Button>
        </div>
        <Label htmlFor="resume">Resume</Label>
        <Textarea
          id="resume"
          value={resumeText}
          onChange={(event) => setResumeText(event.target.value)}
          className="mt-1.5 min-h-40 font-mono text-xs"
        />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Upload className="size-3.5" />
          Upload .txt / .md
          <input
            type="file"
            accept=".txt,.md,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg">Target companies</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {companies.map((company) => (
            <Badge
              key={company}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {company}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-foreground/10"
                onClick={() =>
                  setCompanies((current) =>
                    current.filter((item) => item !== company)
                  )
                }
                aria-label={`Remove ${company}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addCompany(companyDraft);
          }}
        >
          <Input
            value={companyDraft}
            onChange={(event) => setCompanyDraft(event.target.value)}
            placeholder="Add a company"
          />
          <Button type="submit" variant="outline" size="icon">
            <Plus />
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1">
          {SUGGESTED_COMPANIES.filter((name) => !companies.includes(name)).map(
            (name) => (
              <button
                key={name}
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => addCompany(name)}
              >
                + {name}
              </button>
            )
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg">Stop conditions</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <NumberField
            label="Max postings"
            value={maxPostings}
            min={1}
            max={20}
            onChange={setMaxPostings}
          />
          <NumberField
            label="Min score"
            value={minScore}
            min={0}
            max={100}
            onChange={setMinScore}
          />
          <NumberField
            label="Per company"
            value={maxPerCompany}
            min={1}
            max={5}
            onChange={setMaxPerCompany}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant={searchMode === "live-first" ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchMode("live-first")}
          >
            Live boards first
          </Button>
          <Button
            variant={searchMode === "catalog" ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchMode("catalog")}
          >
            Desk catalog
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Live mode hits Greenhouse/Lever intern listings, then falls back to
          the desk catalog so a demo never comes up empty.
        </p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={runAgent} disabled={running}>
            {running ? <LoaderCircle className="animate-spin" /> : <Play />}
            {running ? "Running" : "Run agent"}
          </Button>
          <Button variant="outline" onClick={stop} disabled={!running}>
            <CircleStop />
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function AgentConsole({
  plan,
  log,
  running,
  progress,
  stopReason,
  error,
  planDone,
  logEndRef,
}: {
  plan: Extract<AgentEvent, { type: "plan" }> | null;
  log: LogItem[];
  running: boolean;
  progress: { processed: number; drafted: number; max: number };
  stopReason: string | null;
  error: string | null;
  planDone: number;
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex h-full min-h-[520px] flex-1 flex-col overflow-hidden rounded-xl bg-[oklch(0.27_0.04_248)] text-[oklch(0.95_0.015_90)] ring-1 ring-foreground/15">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-[oklch(0.78_0.05_80)] uppercase">
            Planning loop
          </p>
          <h2 className="font-heading text-xl text-white">Agent</h2>
        </div>
        <div className="text-right text-xs text-white/70">
          <div>
            {progress.processed}/{progress.max} postings
          </div>
          <div>{progress.drafted} letters drafted</div>
        </div>
      </div>
      <div className="px-4 pt-3">
        <Progress value={progress.max ? (progress.processed / progress.max) * 100 : 0} />
      </div>
      {error && (
        <Alert variant="destructive" className="mx-4 mt-3 bg-destructive/15">
          <AlertTitle>Run failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ScrollArea className="h-[640px]">
        <div className="agent-ruled space-y-3 px-4 py-4">
          {!plan && !running && (
            <p className="text-sm text-white/60">
              Idle. Run the agent to watch search → fetch → score → draft →
              file write, then a hard stop before send.
            </p>
          )}
          {plan && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-white">{plan.goal}</p>
              <p className="mt-1 font-mono text-[11px] text-[oklch(0.8_0.05_80)]">
                {plan.stopCondition}
              </p>
              <ol className="mt-2 space-y-1 text-sm text-white/80">
                {plan.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-mono text-[11px] text-white/40">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-white/50">
                Policy: {plan.policy}
              </p>
            </div>
          )}
          {log.map((item, index) => (
            <LogLine key={`${item.type}-${index}`} item={item} />
          ))}
          {stopReason && (
            <div className="flex items-start gap-2 rounded-lg border border-[oklch(0.8_0.05_80)/0.4] bg-[oklch(0.8_0.05_80)/0.12] p-3 text-sm">
              <Stamp className="mt-0.5 size-4 text-[oklch(0.82_0.06_80)]" />
              <div>
                <div className="font-medium text-white">Stopped</div>
                <div className="text-white/75">{stopReason}</div>
                <div className="mt-1 text-[11px] text-white/50">
                  {planDone} tool results. Submit was never on the tool list.
                </div>
              </div>
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

function LogLine({ item }: { item: LogItem }) {
  if (item.type === "plan" || item.type === "progress" || item.type === "done") {
    return null;
  }
  if (item.type === "thought") {
    return (
      <p className="text-sm text-white/75">
        <span className="mr-2 font-mono text-[10px] text-white/35">{item.at}</span>
        {item.text}
      </p>
    );
  }
  if (item.type === "tool_start") {
    return (
      <p className="font-mono text-[12px] text-[oklch(0.8_0.05_80)]">
        ▸ {item.tool} {JSON.stringify(item.args)}
      </p>
    );
  }
  if (item.type === "tool_result") {
    return (
      <p className="text-sm text-white">
        <span className="mr-2 font-mono text-[10px] text-white/35">{item.at}</span>
        {item.ok ? "✓" : "✗"} {item.tool}: {item.summary}
      </p>
    );
  }
  if (item.type === "policy_block") {
    return (
      <div className="flex gap-2 rounded-md border border-[oklch(0.65_0.16_32)/0.5] bg-[oklch(0.52_0.16_32)/0.18] p-2 text-sm">
        <Ban className="mt-0.5 size-4 text-[oklch(0.78_0.12_40)]" />
        <div>
          <div className="font-medium">Blocked {item.tool}</div>
          <div className="text-white/70">{item.reason}</div>
        </div>
      </div>
    );
  }
  if (item.type === "tracker_write") {
    return (
      <p className="text-sm text-[oklch(0.82_0.06_155)]">
        wrote tracker ← {item.row.company} · {item.row.title} · {item.row.score}
      </p>
    );
  }
  if (item.type === "stop") return null;
  return null;
}

function TrackerPanel({
  rows,
  selectedId,
  onSelect,
}: {
  rows: TrackerRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[520px] flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-heading text-xl">Tracker</h2>
          <p className="text-xs text-muted-foreground">
            The agent writes this file. Sending is a human status, not a tool.
          </p>
        </div>
        <a
          href="/api/tracker/export"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
        >
          <FileSpreadsheet />
          CSV
        </a>
      </div>
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full min-h-80 flex-col items-center justify-center gap-2 px-6 text-center">
            <ShieldAlert className="size-8 text-stamp" />
            <p className="font-heading text-lg">Empty desk</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Run the agent to search, score, and draft. Rows show up here for
              you to approve — nothing is sent on its own.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-card text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="px-3 py-2 font-medium">Fit</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-pointer border-b border-border/70 hover:bg-muted/50",
                    selectedId === row.id && "bg-muted/70"
                  )}
                  onClick={() => onSelect(row.id)}
                >
                  <td className="px-3 py-2 align-top">
                    <div className={cn("font-heading text-lg", bandStyle(row.band))}>
                      {row.score}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{row.band}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.company}</div>
                    <div className="text-muted-foreground">{row.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.location}
                      {row.term ? ` · ${row.term}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        statusStyle(row.status)
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ApplicationReview({
  row,
  letterDraft,
  setLetterDraft,
  onApprove,
  onReject,
  onSaveLetter,
  onRequestSend,
}: {
  row: TrackerRow;
  letterDraft: string;
  setLetterDraft: (value: string) => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onSaveLetter: () => Promise<void>;
  onRequestSend: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SheetHeader className="border-b p-4">
        <SheetTitle className="font-heading text-2xl">
          {row.company}
        </SheetTitle>
        <SheetDescription>
          {row.title} · {row.location}
          {row.term ? ` · ${row.term}` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-heading text-3xl", bandStyle(row.band))}>
            {row.score}
          </span>
          <Badge variant="secondary">{row.band} fit</Badge>
          <Badge variant="outline">{row.source}</Badge>
          <a
            className="text-sm underline underline-offset-2"
            href={row.url}
            target="_blank"
            rel="noreferrer"
          >
            Open posting
          </a>
        </div>
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Why this score
          </h3>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {row.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {row.gaps.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-sm text-stamp">
              {row.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Job description
            </h3>
            <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-3">
              <p className="whitespace-pre-wrap text-xs leading-5">
                {row.jobDescription}
              </p>
            </ScrollArea>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Cover letter (yours to edit)
            </h3>
            {row.coverLetter ? (
              <Textarea
                className="letter-sheet min-h-64 font-heading text-sm leading-7"
                value={letterDraft}
                onChange={(event) => setLetterDraft(event.target.value)}
              />
            ) : (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Skipped — score was below the bar, so no letter was drafted.
              </p>
            )}
          </div>
        </div>
        <Alert>
          <ShieldAlert />
          <AlertTitle>Human gate</AlertTitle>
          <AlertDescription>
            Approve the letter, then submit on the company site. Only after that
            can you mark this row sent — and only by typing the company name.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!row.coverLetter || busy !== null}
            onClick={() => run("save", onSaveLetter)}
            variant="outline"
          >
            Save edits
          </Button>
          <Button
            disabled={!row.coverLetter || busy !== null}
            onClick={() => run("approve", onApprove)}
          >
            <Check />
            Approve letter
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("reject", onReject)}
          >
            <X />
            Reject
          </Button>
          <Button
            variant="secondary"
            disabled={row.status !== "approved" || busy !== null}
            onClick={onRequestSend}
          >
            Mark sent…
          </Button>
        </div>
      </div>
    </>
  );
}
