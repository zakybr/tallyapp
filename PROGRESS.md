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
- [x] **4. Research + score** — real-case run done 29 Oct 2026 on the Mac (see "Real-case acceptance").
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

## Real-case acceptance (29 Oct 2026, on the Mac)

- **White Pointer Boats** → Conversation. Verified gaps: contact form says "Email delivery requires configuration", no
  tap-to-call on mobile, nothing measured (no GA4/GTM/pixel), no Google ads, no schema/og:image. Unverified: Companies Office,
  Google profile, Meta ads. Note: they are in **Gisborne**, outside the Auckland regions; region is not a gate.
- **AOMAS** → Conversation, found at aomasmarine.com ("AOMAS Custom Boats") by `find_domain` after the first run wrongly
  passed it as "not found". $230k launch promo, email-only enquiry path, nothing measured, no ads. Register entry unverified.
- Prepare ran on both: opener, call script, 3 emails, one-page audit PDF. All drafts lint-clean.
- Packaged `release/Tally-0.1.0-arm64.dmg`: bundle name Tally, icon = tally mark, agent check passes inside the .app.
  Not yet exercised from the packaged app: a Playwright site audit (needs `npx playwright install chromium` once on the Mac).

## Decisions (29 Oct 2026)

- **Token leak**: with a Claude subscription login, the CLI attached the account's claude.ai connectors to every agent call
  (~130k tokens/turn). `strictMcpConfig: true` + `ENABLE_CLAUDEAI_MCP_SERVERS=false` cut an opener from 518k tokens to 17k.
  Skills are also inlined from `.claude/skills/*/SKILL.md` into the system prompt (`src/main/agents/skills.ts`) rather than
  loaded through the Skill tool. Files stay the editable source of truth and are re-read every run.
- **Search agents** (research, lead finder, scorer) default to Sonnet 5.5; research runs one at a time. Settings → Model overrides.
- **Hard-to-find businesses**: `find_domain` (DNS guesses of name + trade word + TLD), `tally-find-business` skill. A business
  the research cannot identify is left unscored with a next step, never passed (also enforced in save_score for the orchestrator).
- **Watchdog**: an agent silent for 12 minutes is stopped with a clear error; tool calls over 15s are timed in the run log.
- **Audit PDF** always fits one A4 page (auto-scale; if still too long the save tool tells the agent to shorten).
- **Privacy Act 2020**: per-contact access export (IPP 6), retention sweep on start (default 12 months after Pass/Lost, IPP 9),
  company delete removes screenshots and PDFs, person delete scrubs run logs too, agents keep director names only, Settings
  → Privacy explains storage and the Anthropic processing (IPP 12).
- **Companies Office** blocks bots in robots.txt, so register facts come from search results and stay unverified when not
  found. Proposed fix: the free official NZBN API (needs a key), not yet added.

## Next

1. Optional NZBN API key in Settings for Companies Office facts (free; needs Zak's OK and a key).
2. Run a site audit from the installed .app once to confirm Playwright works outside dev.
3. Install: open the .dmg, drag Tally to Applications, then right-click → Open the first time (unsigned).

## Updates (from 0.2.0)

- Installed copies update themselves from GitHub releases of `zakybr/tallyapp` (`src/main/updater.ts`): check on launch
  and every 6 hours, download the `-arm64-mac.zip`, verify SHA-256 against GitHub's asset digest, unpack, and on
  "Restart to update" swap the .app bundle with a detached script. Electron's Squirrel updater can't be used because the
  app is unsigned. The database lives in the user data folder, so updates never touch it.
- **To ship an update:** bump `version` in package.json, commit, push, then
  `node scripts/release.mjs "What changed"` (builds dmg + zip, creates release `v<version>`, uploads both).
- The repo is public, so release files are downloadable by anyone; nothing secret is in the build.
- Test hook: `TALLY_UPDATE_AS_VERSION=0.0.1` makes a copy believe it is older, to exercise a real update.

## Commands

    npm run dev        # hot-reload app
    npm run build      # bundle to out/
    npm run typecheck
    npm test           # vitest unit tests
    npm run e2e        # Playwright Electron smoke test
    npm run dist:mac   # release/Tally-<v>-arm64.dmg
    node scripts/run-job.mjs check   # run an agent job headlessly and stream its log (needs `npm run build`)
    xvfb-run -a npx playwright test  # e2e on Linux (CI/cloud); on the Mac just `npm run e2e`
