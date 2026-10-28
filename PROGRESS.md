# Tally app — progress

Personal prospecting desktop app for Tally Marketing Limited (Zak). Electron + Vite + React + TS + Tailwind v4,
Claude Agent SDK in main, SQLite via better-sqlite3. Source of truth for the method: `.claude/skills/tally-*`.

## Phases

- [x] **1. Scaffold + theme** — electron-vite shell, tokens (`src/renderer/src/styles/index.css`), sidebar, empty screens,
      tally-mark icon (`npm run icon`), unsigned arm64 .dmg (`npm run dist:mac`) verified to launch (`node scripts/smoke-packaged.mjs`).
- [x] **2. Data** — SQLite schema + forward-only migrations (`src/main/db/migrations.ts`), repo (`src/main/db/repo.ts`),
      typed IPC (`src/shared/ipc.ts` ↔ `src/main/handlers.ts`), Pipeline board (drag to change stage, proposal-cap confirm) + table
      with vertical/area/verdict/gap filters, Prospect detail (facts, next step, contacts with consent basis + Privacy Act delete,
      notes, timeline), Settings (rate card, rules, region, verticals, conflicts, suppression, revenue, auth, sender, theme,
      CSV export, full backup). API keys encrypted with safeStorage. 20 unit tests + 2 e2e tests. Code review: 10 findings, all fixed.
- [x] **3. Agent plumbing** — `src/main/agents/runner.ts` (jobs, AbortController cancellation, streaming log, usage from
      `result.modelUsage`), `env.ts` (subscription auth: strips ANTHROPIC_API_KEY so the bundled CLI uses the Claude Code
      login; optional API key mode), `jobs.ts` (job registry + Connection check), Agents screen (history, run log, 7-day usage,
      cancel / cancel all). Verified: check job ran on claude-opus-5-5 "via Claude Code login", loaded all 5 skills, 2.6k tokens;
      cancellation leaves no orphan CLI process. Code review for phases 3+4 is done together at the end of phase 4.
- [~] **4. Research + score** — code complete; **the real-case run (AOMAS, White Pointer) still has to be done on the Mac.**
      robots.txt + rate limit (`src/main/audit/robots.ts`), Playwright site audit at desktop + 375px with screenshots
      (`src/main/audit/siteAudit.ts`), Lead Finder / Research / Scorer jobs and the orchestrator (`src/main/agents/research.ts`),
      evidence rule enforced in code (`src/main/agents/evidence.ts`), verdict consistency check (`expectedVerdict`), Find screen,
      evidence cards, gaps checklist, Instagram benchmark with peer-median flag.
- [x] **5. Prepare + contact** (`src/main/agents/prepare.ts`) — opener, call script, email sequence, audit PDF and debrief jobs, plus
      a `prepare` job that runs all four drafts. Save tools are shared with the orchestrator via `extraTools`.
      Audit PDF: `src/main/audit/auditHtml.ts` (pure HTML, per the tally-audit-pdf skill) printed to A4 by a hidden sandboxed
      window (`pdf.ts`) into `<userData>/audits/<slug>-<companyId>-audit-<date>.pdf`; a PDF marked sent is never overwritten.
      Prospect detail: editable opener/script/emails (live lint: word count, subject length, hype, US spelling, em dash, opt-out),
      Copy, Open in mail app (mailto), "I sent this" log, audit Open / Show in Finder, Debrief box + history
      (`src/renderer/src/components/prospect/Prepare.tsx`). Call mode (`screens/CallMode.tsx`): opener, numbered script,
      first-call question, verified gaps, notes, outcome buttons; closing logs the call (notes saved to the timeline first)
      and hands notes to the Debrief Agent. No answer → "Call again" next working day.
      Compliance: opted-out companies are blocked in main (`companySuppressed`, `repo.hasOptedOut`); a guessed/unsourced
      address needs a confirm (main throws "Compliance check:", the renderer confirms and retries with `acknowledged`;
      declining Prepare still drafts opener/script/audit). The orchestrator path refuses risky addresses in `save_emails`.
      Opt-out via debrief suppresses every address **and the domain**, withdraws unsent emails, and logs `opt_out`.
- [x] **6. Polish + package** — Today (calls to make, follow-ups due with overdue flag, live proposals x/cap with tally slots,
      retainers vs target + MRR, trailing-12 revenue vs GST threshold, running agents, pipeline tally strip), ⌘K command
      palette (screens, prospects, call mode, backup, CSV, dark mode). Code review (phases 3–5): 10 findings, all fixed.
      **Still to do on the Mac:** `npm run dist:mac` and launch the .dmg; real agent runs of every Phase 5 agent.

## Decisions

- **Brand**: tally mark geometry copied verbatim from tallyweb `components/TallyMark.tsx` (locked). Accent is amber
  `#f0a52c` per the app brief (the website uses orange `#ff4a1c`; the brief asked for amber, and the site's accent is not locked).
- **Type**: Barlow Condensed (display, matches tallynz.co), General Sans (UI, copied from tallyweb under the Fontshare FFL),
  JetBrains Mono (run log, URLs). Tabular numerals via `.num` / tables.
- **Positioning** pulled from live tallynz.co (Oct 2026): Auckland social/marketing agency, no targets or guarantees,
  free audit first. The old primary-sector recruitment / guarantee model in the synced tally-prospect/debrief/contract skills is dropped.
- **Module format**: package is ESM (`"type": "module"`); preload is emitted as CJS (`out/preload/index.cjs`) because sandboxed preloads must be CJS.
- **better-sqlite3 v13** ships prebuilds; native rebuild warning about the space in "Tally App" is harmless.
- **Signing**: no Developer ID certificate on this Mac (`security find-identity` shows 0), so builds are unsigned.

- **Dates**: due dates are local NZ dates (`localDate()` in `src/shared/rules.ts`), never `toISOString().slice(0,10)`.
- **Delete person** scrubs name/email/phone with boundary-aware regex across activities, findings, debriefs and drafts; the
  suppression entry is kept so an opt-out survives deletion.

- **Agent isolation**: `settingSources: ['project']` with `cwd = agentHome()` — loads only this repo's `.claude/skills`, never
  the user's global plugins/hooks. `permissionMode: 'dontAsk'` + an explicit `tools`/`allowedTools` list per agent.
  `persistSession: false` so runs don't clutter `~/.claude/projects`.
- **Skills location**: dev = repo `.claude/skills`; packaged = `~/Library/Application Support/Tally/agent-home/.claude/skills`,
  seeded once from the bundle and never overwritten (edits survive updates).

- **Fake agents for tests**: `TALLY_FAKE_AGENTS=1` swaps the SDK for `src/main/agents/fake.ts`, which calls each agent's *real*
  save tool with fixture data. The e2e flow test uses it, so validation, compliance, saving, PDF and UI are tested with no
  model, network or login. Never set it in normal use.
- **Evidence screenshots** must live inside that company's own `evidence/<id>/` folder (`ownScreenshot`); this also fixed a
  prefix bug where `evidence/1` matched `evidence/12`.
- **Em dashes** are stripped with their surrounding spaces (`noEmDash`) from every saved draft.
- **Call notes** go on the timeline as a `call` activity before the debrief starts, so a failed agent never loses them.
- **Cloud session (28 Oct 2026)**: phases 4 (tests/review), 5 and 6 were built in a Claude Code cloud container (Linux, no
  outside web access). better-sqlite3 v13's N-API prebuild loads in Electron without a rebuild, so `npm test`, the
  Electron e2e suite (under `xvfb-run`) and an unpacked Linux package were all verified there. Agents were not run for real
  there, and no live sites were audited.

## Next (on the Mac)

1. `git pull`, `npm ci`, `npm run build`, `npm test`, `npm run e2e`.
2. Phase 4 acceptance: research **AOMAS, Orewa** and **White Pointer Boats** for real (`node scripts/real-case.mjs` or the UI),
   check the evidence records, then Prepare both and read every draft and the audit PDF.
3. `npm run dist:mac`, open `release/Tally-0.1.0-arm64.dmg`, drag to Applications. It is unsigned (no Developer ID on this
   Mac): the first time, right-click Tally in Applications → Open → Open. If macOS still blocks it, System Settings →
   Privacy & Security → "Open Anyway". Or run `xattr -dr com.apple.quarantine /Applications/Tally.app` once.

## Commands

    npm run dev        # hot-reload app
    npm run build      # bundle to out/
    npm run typecheck
    npm test           # vitest unit tests
    npm run e2e        # Playwright Electron smoke test
    npm run dist:mac   # release/Tally-<v>-arm64.dmg
    node scripts/run-job.mjs check   # run an agent job headlessly and stream its log (needs `npm run build`)
    xvfb-run -a npx playwright test  # e2e on Linux (CI/cloud); on the Mac just `npm run e2e`
