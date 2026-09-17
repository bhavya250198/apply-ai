# Co-op Desk

A human-in-the-loop **co-op application agent**. Paste a resume and a list of target companies. The agent searches intern / co-op postings, pulls each job description, scores fit against the resume, drafts a tailored cover letter, and writes a tracker. It **never submits** an application.

This is the grind a student already does by hand: search, skim, decide, write, spreadsheet. The agent does the loop. The student still owns the send.

## What it does

1. **Search** — Greenhouse and Lever public boards first (intern / co-op / student titles only). If a board is empty or blocked, it falls back to a desk catalog so the demo always has real-feeling postings.
2. **Fetch** — Pulls the full job description.
3. **Score** — Fit 0–100 from skills, student-role signals, location, and resume-bullet overlap. Senior postings get penalized.
4. **Draft** — A cover letter that uses the student’s name, school, matched skills, and the strongest resume bullets. It will not claim experience that is not on the resume.
5. **Write tracker** — Appends `data/tracker.json`. Export CSV when you want a spreadsheet.
6. **Stop** — After **N** postings, or when every company has been searched.
7. **Human gate** — Approve the letter, submit on the company site yourself, then type the company name to mark the row sent.

## Why a human stays in the loop

Auto-submit is a flashy demo and a bad agent. Applications are high-stakes and usually irreversible. Fit scores miss term dates, work authorization, interview load, and whether you actually want the team. Cover letters have to sound like you. The honest interview answer is: **tools do the grind; people take responsibility for anything that leaves the desk.**

The agent’s tool list is `search_postings`, `fetch_job`, `score_fit`, `draft_cover_letter`, and `write_tracker`. `submit_application` / `send_email` are forbidden in code, not just in a prompt.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43145](http://127.0.0.1:43145). Load the sample resume or paste your own, keep or edit the company list, then **Run agent**.

```bash
npm test    # policy, scoring, N-posting stop condition
npm run lint
npm run build
```

No API keys are required. Live board search uses public Greenhouse/Lever JSON. If a company has no intern listings right now, the catalog still fills the tracker.

## Using it for a real cycle

- Paste your resume (plain text). PDF upload is not parsed — copy the text.
- Set **max postings** (the stop condition), **min score**, and **per company**.
- Prefer **Live boards first** during intern season; use **Desk catalog** for a deterministic demo.
- Edit every letter. Approve. Apply on the company site. Only then mark sent.

The tracker file lives at `data/tracker.json` on the server that ran the agent.
