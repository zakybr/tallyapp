# PLAN: Relationships, Boards, Research

Phase 0 output for [FEATURES_BRIEF.md](FEATURES_BRIEF.md). Written 29 Oct 2026 from reading the code at `e0a7370` (v0.2.2). Nothing is built yet. Decisions marked **Zak to decide** need an answer before the relevant phase starts.

---

## Decisions so far (29 Oct 2026)

- **Signing: option A** (free local self-signed certificate). Zak creates it once; `scripts/release.mjs` signs every release with it.
- **Built-in screen recording is dropped.** Zak records with QuickTime (whole desktop). Boards still play dropped-in `.mov`/`.mp4` files inline. Phase 3 is now present mode only, so Screen Recording, Camera, Microphone and Accessibility permissions are no longer needed. Section 3.3's recording plan is kept below for reference only.
- Canvas: Excalidraw (pending Zak's view on the font limit).
- **Phase 1 (Relationships) built** 29 Oct 2026; see CHANGES.md.

## 0. Read this first: code signing

`codesign -dv release/mac-arm64/Tally.app` shows `Signature=adhoc` and `Identifier=Electron`.

macOS ties Screen Recording, Camera, Microphone and Accessibility permission (TCC) and Keychain item access to the app's code signature. An ad-hoc signature changes with every build, so **after every self-update macOS would ask again for Screen Recording, Camera and Microphone, and Keychain would prompt for each stored key**. Boards recording (Phase 3) and Keychain keys would be painful without fixing this.

| Option | Cost | What you get |
|---|---|---|
| **A. Local self-signed certificate** (recommended now) | Free | Create a "Tally Local Signing" code-signing certificate once in Keychain Access. `scripts/release.mjs` signs every build with it, and the bundle identifier becomes `co.tallynz.tally` in the signature. Permissions then survive updates on this Mac. Gatekeeper still treats the app as unidentified (first install stays right-click → Open; self-updates are not quarantined, so they open normally). |
| B. Apple Developer Program | **US$99/year** | Developer ID signing and notarisation. No Gatekeeper warning, works on any Mac. Only worth it if Tally ever runs on another machine. |

**Zak to decide: A or B.** I'd do A as the first task of Phase 1. It touches only build config and the release script, and needs about two minutes of clicking in Keychain Access, which I'll walk you through.

---

## 1. What exists today (read from the code)

| Area | How it works now | File(s) |
|---|---|---|
| Stack | Electron 45, electron-vite, React 19, TypeScript, Tailwind v4. Main / preload / renderer split, context isolation on, no Node in the renderer. | `electron.vite.config.ts`, `src/main`, `src/preload`, `src/renderer` |
| IPC | One typed contract: `TallyApi` plus the `API_METHODS` list in shared, with one `handle()` per method in main and `window.tally` in the renderer. Events: `job:log`, `job:update`, `data:changed`, `update:status`. | `src/shared/ipc.ts`, `src/main/handlers.ts`, `src/preload/index.ts` |
| Navigation | Hash router (`today`, `find`, `pipeline`, `prospect/:id`, `call/:id`, `agents`, `settings`), sidebar with ⌘1–4 and the ⌘K palette. | `src/renderer/src/lib/router.ts`, `components/Sidebar.tsx`, `components/CommandPalette.tsx` |
| Data | SQLite (better-sqlite3) at `~/Library/Application Support/Tally/tally.db`, with WAL and foreign keys on. Forward-only migrations (3 so far); all SQL lives in the repo layer. | `src/main/db/migrations.ts`, `src/main/db/repo.ts` |
| Tables | `companies`, `contacts` (email source and consent basis), `research_records`, `benchmarks`, `scores`, `outreach`, `activities`, `debriefs`, `suppression_list`, `conflicts`, `revenue`, `settings`, `jobs`, `job_logs`, `lead_runs` | same |
| Files | Evidence screenshots in `userData/evidence/<companyId>/`, audit PDFs in `userData/audits/`, served to the renderer through the `tally-file://` protocol (user-data folder only). | `src/main/index.ts`, `src/main/context.ts` |
| Claude | `@anthropic-ai/claude-agent-sdk` `query()` in the main process, using your Claude Code login (API key optional). Only Tally's tools are attached (`strictMcpConfig`, claude.ai connectors off). Skills are inlined from `.claude/skills/*/SKILL.md`. Results come back through `save_*` tools validated by zod. The job runner has a streaming run log, cancel, usage tracking and a 12-minute stall watchdog. | `src/main/agents/runner.ts`, `skills.ts`, `definitions.ts`, `research.ts`, `prepare.ts`, `src/shared/schemas.ts` |
| Agent tools | `fetch_page` (respects robots.txt; never LinkedIn or Google Maps), `site_audit` (Playwright at desktop and 375px: GA4, GTM, pixel, UA, forms, tel/mailto, schema, og:image, broken links, screenshots), `find_domain`, `ads_transparency_check`, `companies_office_link`, `places_search` (optional key), `check_pipeline` | `src/main/agents/tools.ts`, `src/main/audit/*` |
| Keys | `apiKey` and `placesApiKey` are encrypted with Electron `safeStorage` (the encryption key lives in Keychain) and stored as ciphertext in SQLite. The renderer only ever sees masked values. | `src/main/secrets.ts` |
| Drafting rules | `lintEmail` (subject under 6 words, body under 150, no em dash, no hype words, NZ spelling, opt-out line) plus `noEmDash` / `finaliseEmail`. UEM Act suppression list. Privacy Act export, retention and delete. | `src/shared/rules.ts`, `src/shared/drafts.ts`, `src/main/privacy.ts` |
| Design | Near-black chrome, warm paper panels, amber `#f0a52c`, Barlow Condensed display, General Sans UI, JetBrains Mono labels, tally-mark motif. | `src/renderer/src/styles/index.css` |
| Updates | Self-updater from GitHub releases of the public repo `zakybr/tallyapp`; `scripts/release.mjs` publishes. | `src/main/updater.ts` |
| Not present yet | Notifications, a tray / menu-bar item, open-at-login, any canvas, any media capture. | |

### What the new modules reuse

| Need | Reuse |
|---|---|
| Person ↔ company link | `companies` (dedupe via `findDuplicate` / `normaliseDomain`) |
| Published emails with a source | the `contacts` pattern (`email_source_url`, `consent_basis`), suppression list, Privacy Act delete and export |
| Drafting with Claude | the job runner and `save_*` tool pattern; a new `relationship_touch` agent and a new skill file |
| Writing rules | extend `lintEmail` with a `relationship` profile (sign-off "Zak / Tally / tallynz.co"; no exclamation marks, emoji or calendar links; no guarantee or "agreed target" wording; no AI tells) rather than duplicating it |
| Website presence check | `site_audit`, which already finds gtag, GTM, `fbq` and old UA. Add `dataLayer`, `ttq` and `AW-` detection. Also `find_domain` and `places_search`. |
| Industry and region inputs | the grouped `Combobox` and the `CATEGORY_CATALOG` / `AREA_CATALOG` lists |
| Local media in the renderer | the `tally-file://` protocol, extended to the Boards folder |
| Long jobs | the job runner (Research batches, primers) |

---

## 2. Boards canvas: recommendation

The renderer is already Chromium, so a web canvas runs natively with no WKWebView and no bridge beyond the existing IPC.

| | **Excalidraw** `@excalidraw/excalidraw` 0.18.1 | tldraw SDK | Custom (Konva / react-konva 10.9 / 19.3) |
|---|---|---|---|
| Licence | **MIT** | **Commercial licence key required in production.** Free 100-day trial only. The hobby licence is discretionary, non-commercial and carries a watermark. Tally is a commercial business, so this means a paid licence priced through sales ([tldraw licence](https://tldraw.dev/community/license)). | MIT |
| Infinite canvas, pan/zoom, grid, snap | Yes | Yes | Build it |
| Rectangle, rounded rectangle, ellipse, diamond, line, arrow | Yes | Yes | Build it |
| Connectors that stay attached | Yes (arrow binding) | Yes | Build it (hard) |
| Freehand pen | Yes | Yes | `perfect-freehand` (MIT) |
| Sticky notes | A filled rectangle with bound text, saved as a library item | Yes | Build it |
| Frames usable as slides | Yes (frames, exportable per frame) | Yes | Build it |
| Group, align, distribute, layers, lock, duplicate, undo/redo | Yes | Yes | Build it |
| Images, paste from clipboard | Yes | Yes | Build it |
| Local video playing inline | `embeddable` element with `renderEmbeddable` returning a `<video src="tally-file://…">` | Built-in video shape | Konva image with a video source |
| PDF page | Render the chosen page to PNG with `pdfjs-dist` (Apache-2.0), insert as an image, and keep the page number to re-render | same | same |
| Fonts | **The gap.** A fixed set of font families with no weight control. Workaround: re-point the built-in family slots at Tally fonts with `@font-face` (sans → General Sans, code → JetBrains Mono, a heading slot → Barlow Condensed). 0.18 also has a `Fonts.register` path to evaluate. Arbitrary system fonts and per-text weight are not realistic. | Four font slots you can re-point. Rich text (v3) can add weight. | Full control |
| Templates and saved style presets | Library items, plus our own preset store | Yes | Build it |
| Build effort for Phase 2 | Moderate: mostly saving, library and export glue | Moderate, plus the licence | Large (weeks) |

**Recommendation: Excalidraw.** It's MIT, already covers almost every canvas feature in the brief, and runs locally inside the existing renderer. Local video goes through `renderEmbeddable` and our `tally-file://` protocol. The one real compromise is text styling: you get Tally's three fonts as presets (headings, UI text, mono labels) and sizes, colours and alignment, but not arbitrary system fonts or a free weight control.

**Zak to decide:** is that font limit acceptable? If arbitrary fonts and weights matter more, the choice is tldraw (pay for a commercial licence) or a custom Konva canvas (free, but a much longer Phase 2).

The "Tally" style preset uses the brief's exact colours: near-black `#0B0B0A`, cream `#F2EDE4`, amber `#D9711A`. The app chrome around the canvas keeps the existing design (the brief says to match the existing design).

---

## 3. Module plans

### 3.1 Relationships (Phase 1)

**Screens**
- A **Relationships** sidebar item with three tabs:
  - **Due:** everyone whose touch is due or overdue, with the suggested action, their last "told me", advice and promises shown inline, and a Draft button.
  - **Board:** stage columns, drag to move, each card shows days since last touch.
  - **People:** a searchable list.
- A **Person page** with header, facts, the cadence editor, an interaction timeline, open promises (tick off when done), linked boards, and "Draft next touch".
- **Log interaction** dialog: date, type (met, call, email, text, LinkedIn), notes, plus the three structured fields: what they told me, advice they gave, what I promised. Saving it moves the stage and next-touch date along the cadence.
- The Today screen gets a "Relationship touches due" card. Another session is editing Today right now, so this is wired in Phase 1, not now.

**Cadence** (defaults, editable per person, stored as JSON on the person):
- `met` → thank-you due the same day
- → "acted on your advice" around day 7
- → value touch around day 18
- → "invite to share what I'm building" from about day 28

Logging a touch of the expected type advances the stage and schedules the next one. Overdue touches stay on the Due list until logged or snoozed.

**Drafting:** a new `relationship_touch` agent (Opus, no web tools, only `read_person` and `save_touch_draft`) and a new skill `.claude/skills/tally-relationship-touch/SKILL.md` holding the voice and rules.
- The prompt contains only that person's own notes and promises.
- The thank-you must quote one specific thing they said; the day-7 note reports what Zak did with their advice; the value touch offers something useful with no ask.
- **Pitch gate:** if the stage is before "Invited to share" and a pitch is requested, main returns a warning. The renderer confirms once; overriding is logged on the timeline.
- Drafts open with **Copy** or **Open in Mail** (`mailto:`). Nothing sends.

**Reminders**
- An Electron `Tray` icon in the menu bar showing the due count (`tray.setTitle('3')`), with a menu listing due people.
- One `Notification` each morning (default 8:00, set in Settings) listing due touches. Clicking it opens the Due tab.
- To fire while the window is closed, Tally runs in the background with only the menu-bar icon, and starts at login, hidden (`app.setLoginItemSettings`). If macOS refuses that for an unsigned app, the fallback is a LaunchAgent plist in `~/Library/LaunchAgents`. Signing option A makes the first route reliable.

### 3.2 Boards: canvas, saving, library, export (Phase 2)

- A **Boards** sidebar item, a library screen and a full-window board editor.
- **Folder per board** at `~/Library/Application Support/Tally/Boards/<board-id>/` (this is the Electron `userData` path already, so the app owns it):

```
<board-id>/
  board.json          Excalidraw scene (elements, appState subset, file refs) + Tally meta (name, tags, frames order)
  assets/             copied media: <sha256>.<ext> (images, pdf pages, videos, recordings)
  thumbnail.png       library thumbnail, regenerated on save (debounced)
  versions/<ISO>-<slug>.json   named snapshots
```

- **SQLite index:** a `boards` table (id, name, tags, folder, favourite, trashed_at, timestamps), plus `board_links` and `board_presets` (see section 4). The JSON file is the source of truth for content; SQLite only indexes it for search.
- **Autosave** 800 ms after the last change. The file is written to a temp file and renamed (an atomic write). **Snapshots** are named copies of `board.json` that you can restore; assets are shared and never deleted while any snapshot uses them.
- **Media:**
  - Dropped or pasted files are copied into `assets/` (named by content hash), so moving the original never breaks a board.
  - Videos (mp4 and mov) play inline via an `embeddable` element.
  - For PDFs you pick a page, which is rendered to PNG with pdfjs.
- **Library:**
  - grid of thumbnails, search by name and tag, folders, favourites
  - duplicate (copies the folder)
  - trash with restore (soft delete; purged after 30 days)
  - link to a person or company, so the board shows on their page
  - templates: "Save as template" copies the board into `Boards/_templates/`
- **Copy between boards:** Excalidraw's clipboard format plus copying the referenced assets.
- **Export:**
  - PNG with `exportToBlob`, per frame or the whole board.
  - PDF built from SVG per frame, through a hidden window's `printToPDF` (the same approach as the audit PDF).
  - `.tallyboard`: a zip of the folder via `yazl` / `yauzl` (MIT). Importing it creates a new board id.

### 3.3 Boards: present and record (Phase 3)

- **Present mode** opens a frameless full-screen window that steps through frames in order (arrow keys or click), with a laser pointer (a fading pointer trail drawn on an overlay canvas) and all UI hidden. Esc exits.
- **Capture** uses Electron's `desktopCapturer` / `getDisplayMedia` with `session.setDisplayMediaRequestHandler`, so Tally shows its own picker: this board window, any window, or a whole screen. On macOS, Chromium captures through ScreenCaptureKit.
- **Microphone:** `getUserMedia({ audio })`, mixed in through WebAudio.
- **Camera bubble:** `getUserMedia({ video })`. The screen and camera tracks are composited into an offscreen canvas (circular mask, draggable on a small control overlay) and recorded from `canvas.captureStream()`. So the bubble is in the recording whichever window is captured.
- **Cursor highlight:** the main process polls `screen.getCursorScreenPoint()` at 60 fps (no permission needed), and the highlight is drawn in the composite.
- **Click ripples:**
  - Inside Tally's own windows they come from pointer events (no permission).
  - For other windows and full screen, a global mouse hook is needed: `uiohook-napi` (MIT), which needs **Accessibility** permission. **Zak to decide:** accept that permission, or have ripples only when recording Tally windows.
- **Pause and resume:** `MediaRecorder.pause()` / `.resume()`.
- **Format:** `MediaRecorder` with `video/mp4;codecs=avc1,mp4a.40.2` (H.264 MP4, supported by the Chromium in Electron 45; verified at build time). If a codec is ever unavailable: record WebM, then convert with macOS's built-in `/usr/bin/avconvert`.
- **Trim start and end:** `/usr/bin/avconvert --preset PresetPassthrough --start … --duration …` (built into macOS, no re-encode, no new dependency). This avoids bundling ffmpeg, which is GPL-3.0 and would ship in the public releases.
- **Recordings** go to `<board>/assets/rec-<timestamp>.mp4` and are indexed in `board_recordings` (name, duration, size, trim points). The board's Recordings list can rename, trim, drop onto the canvas, export (copy to a chosen folder) or delete.
- **Permissions** are asked for the first time each is needed, with an explanation before the system prompt:
  - **Screen Recording:** macOS has no prompt API. Tally explains why, then opens System Settings → Privacy & Security → Screen Recording.
  - **Microphone and Camera:** `systemPreferences.askForMediaAccess`, with Info.plist strings added through electron-builder `mac.extendInfo`. Proposed wording: NSMicrophoneUsageDescription "Tally records your voice over board walkthroughs you choose to record." NSCameraUsageDescription "Tally shows your camera in a bubble on recordings you choose to make."
  - **Accessibility:** only if click ripples outside Tally are chosen.

### 3.4 Research: NZ company finder (Phase 4)

**Reuse, not rebuild.** The Find screen and the Lead Finder already take an industry and region and return up to 24 deduplicated businesses. Research becomes a new top-level screen built on that code: the same Combobox presets, plus the brief's list (marine, aviation, horticulture, seafood, forestry, food processing, construction, HVAC, tourism and hire, motorhomes, pools). It adds a size signal, "Exclude existing contacts", a results table and briefings. Find stays as it is for the cold-prospecting pipeline.

**Sources**
| Source | Access | Cost |
|---|---|---|
| **NZBN API v5** at `api.business.govt.nz`: legal name, status, incorporation date, registered address, industry code (ANZSIC), roles (directors), shareholdings | Subscription key you add in Settings | **Free** (needs a business.govt.nz developer account) |
| **Companies Office** register via api.business.govt.nz where NZBN lacks detail | Subscription key | Free |
| Google Places API (New): listing, phone, website, rating, review count, opening hours | Existing optional key | **Paid by Google per request.** Text Search plus Place Details costs a few cents per company. Shown before a batch. |
| The company's own website | `fetch_page` / `site_audit` (robots.txt respected) | Free |
| Claude with web search: news, industry context, primers | Agent SDK | Included in your Claude subscription. In API key mode it is billed per token, plus a per-search fee. |

These modules never touch LinkedIn or any scraping-forbidden site, and never guess email addresses. Every person, email and phone records its source URL (or "NZBN register") and a checked-at date, using the existing `consent_basis` and source-URL pattern.

**Per company output**
A **briefing** with:
- **Snapshot:** what they sell, size signals, locations, ownership, years trading.
- **People:** each with role and source.
- **Presence check:** all tags found in the page source, the contact path, Google listing completeness and social links, each with its observation date.
- **Presence score:** 0–100, from a visible formula: points for tracking, contact path, listing and social presence, so the number is explainable.
- **Opportunities:** two or three, each with a source.
- **Approach:** who to contact first, and Relationships or direct sales.
- **Opening call:** ends in one question.
- **Opening email:** passes the relationship lint profile.
- **Verification flags:** any claim the outreach depends on is marked **"check before sending: …"**. Anything not confirmed is labelled **UNVERIFIED** in the UI and in drafts.

**Industry primer:** one per industry, cached in SQLite with sources and a refresh button. It covers how the industry makes money, seasonality, buyer types, the language they use, the big players, recent news, regulations, and five questions to ask a director.

**Workflow**
- Results table with sort, filter and shortlist.
- Staleness badges (for example, older than 60 days shows "Refresh").
- **"Send to Relationships"** creates or links the company and creates the person at the *Identified* stage.
- **Before a batch:** the cost estimate is shown (Places calls × price, plus Claude usage as an estimated share of plan). The batch size cap lives in Settings (default 10).

---

## 4. Data model (migrations 4–7, forward-only)

All new tables have `created_at` / `updated_at` (ISO 8601 UTC; due dates are local NZ dates, as already decided).

```sql
-- Phase 1: Relationships
people (id, name, role, company_id → companies NULL, phone, phone_source, email, email_source_url, consent_basis,
        linkedin_url,          -- stored only if Zak pastes it; never fetched
        how_met, introduced_by, interests, tags_json,       -- industry, region
        stage,                 -- identified | first_contact | booked | met | thanked | acted_on_advice | value_touch
                               -- | invited_to_share | pitched | client | advisor_only | parked
        cadence_json,          -- {"thank_you":0,"acted":7,"value":18,"invite":28}
        next_touch_on, next_touch_kind, pitch_override_at, external_ids_json, …)
interactions (id, person_id → people, occurred_on, kind,   -- met | call | email | text | linkedin
              notes, told_me, advice, promised, …)
promises (id, person_id, interaction_id, text, due_on, done_at)   -- extracted from interactions.promised; ticked off
relationship_drafts (id, person_id, kind, subject, body, lint_json, overrode_pitch_gate, sent_by_me_at)

-- Phase 2–3: Boards (content lives in the folder; this is the index)
boards (id TEXT PRIMARY KEY, name, tags_json, folder, favourite, is_template, trashed_at, …)
board_links (board_id, person_id NULL, company_id NULL)
board_presets (id, name, style_json)                 -- "Tally" preset seeded
board_recordings (id, board_id, file, name, duration_ms, bytes, trim_start_ms, trim_end_ms, …)

-- Phase 4: Research
research_runs (id, industry, region, size_filter, exclude_existing, status, batch_size, est_cost_json, job_id, …)
research_results (run_id, company_id, presence_score, shortlisted, status)
company_registry (company_id, nzbn, company_number, legal_name, status, incorporated_on, registered_address,
                  anzsic_code, directors_json, shareholders_json, fetched_at, source)
company_people (id, company_id, person_id NULL, name, role, source_kind, source_url, checked_at)
company_briefings (company_id, snapshot_json, presence_json, opportunities_json, approach_json,
                   call_script, email_subject, email_body, flags_json, sources_json, researched_at)
industry_primers (industry PRIMARY KEY, body_json, sources_json, researched_at)
```

- **Future HubSpot / Notion sync:** an `external_ids_json` column (for example `{"hubspot":"123","notion":"abc"}`) is added to `companies` and `people` now. No sync code yet.
- **Privacy Act:** delete-person, access export and retention extend to `people`, `interactions`, `promises` and `relationship_drafts`. A person linked to a board unlinks rather than deleting the board.

---

## 5. File layout (new code)

```
src/main/relationships/   repo + cadence.ts + reminders.ts (Tray, Notification, login item)
src/main/boards/          store.ts (folders, atomic writes, versions, trash), assets.ts, export.ts, tallyboard.ts, recorder.ts, permissions.ts
src/main/research/        nzbn.ts, places.ts, briefing.ts (agent + save tools), primer.ts, cost.ts
src/main/agents/          + relationship_touch, research_briefing, industry_primer definitions
src/shared/               relationships.ts, boards.ts, research.ts (types + zod), rules.ts (+ relationship lint profile)
src/renderer/src/screens/ Relationships.tsx, Person.tsx, Boards.tsx (library), Board.tsx (editor), Present.tsx, Research.tsx, Briefing.tsx
src/renderer/src/components/boards/   ExcalidrawHost.tsx, VideoEmbed.tsx, RecorderBar.tsx, CameraBubble.tsx, Picker.tsx
.claude/skills/           tally-relationship-touch, tally-company-briefing, tally-industry-primer
```

New IPC methods go into `TallyApi` and `API_METHODS` as today. The `tally-file://` handler also allows `userData/Boards/**`.

---

## 6. Libraries and licences

| Library | Licence | Use |
|---|---|---|
| `@excalidraw/excalidraw` 0.18.1 | MIT | Board canvas |
| `pdfjs-dist` 6.4 | Apache-2.0 | Render a PDF page to an image |
| `yazl` / `yauzl` | MIT | `.tallyboard` export and import |
| `uiohook-napi` | MIT | Optional: click ripples outside Tally (needs Accessibility) |
| `@napi-rs/keyring` | MIT | Optional: literal Keychain items for keys (see section 7) |
| macOS `avconvert` | built into macOS | Recording trim and fallback transcode |
| Not used: tldraw | commercial | Licence needed for commercial production use |
| Not used: ffmpeg-static | GPL-3.0 | Would ship a GPL binary in the public releases; avoided |

---

## 7. Keys and permissions

**API keys:**
- **Today:** encrypted with `safeStorage`, where the encryption key is in Keychain and the ciphertext is in SQLite.
- **Brief:** keys in the macOS Keychain, not in files.
- **Plan:** move every key (Anthropic, Places, NZBN, Companies Office) to individual Keychain items through `@napi-rs/keyring`, and keep only a "key is set" flag in SQLite. **This needs signing option A**, or Keychain asks for permission again after every update.
- **Zak to decide:** move to Keychain items (recommended), or keep the current safeStorage approach.

**Keys you'll need to add (Phase 4):**
1. NZBN API subscription key: free, from a developer account at api.business.govt.nz.
2. Companies Office API subscription key, if NZBN roles prove insufficient: free.
3. Google Places API key: **paid per request**. Already optional in Settings.

**macOS permissions, each asked only when first needed:**
| Permission | When | How |
|---|---|---|
| Notifications | First morning reminder, Phase 1 | macOS prompt |
| Open at login / background | When you turn on reminders, Phase 1 | Login item, or LaunchAgent fallback |
| Screen Recording | First recording, Phase 3 | Explainer, then opens System Settings |
| Microphone | First recording with audio | `askForMediaAccess`, with the Info.plist string |
| Camera | First time the camera bubble is turned on | `askForMediaAccess`, with the Info.plist string |
| Accessibility | Only if click ripples outside Tally are chosen | Explainer, then opens System Settings |

**Anything paid:**
- Google Places API calls (Google billing).
- The optional Apple Developer Program (US$99/yr).
- The optional tldraw commercial licence (not recommended).
- Claude usage stays on your subscription unless API key mode is switched on.

---

## 8. Phase order and QA

| Phase | Scope | Demo and QA at the end |
|---|---|---|
| 1 | Signing option A, then Relationships (data, Due/Board/People views, person page, log interaction, cadence, drafting with the pitch gate and lint profile, tray count, morning notification) | Seed 8 fictional directors across stages. Walk through logging a meeting, seeing the touches come due, drafting each touch type, the pitch-gate warning and override, and the notification. Existing tests stay green, plus new unit tests for cadence and lint. |
| 2 | Boards canvas, saving, library, snapshots, trash, templates, presets, links, PNG/PDF/.tallyboard export | One board with every shape, text styles, an image, a PDF page and a video. Quit, relaunch, confirm it reloads and the video plays. Round-trip a .tallyboard. |
| 3 | Present mode (frames as slides, laser pointer, hidden UI). Recording dropped: QuickTime files are dropped onto boards as videos. | Present a board end to end; drop a QuickTime .mov on the canvas, relaunch, confirm it plays. |
| 4 | Research: NZBN, Places, site presence, briefing and primer agents, results table, cost estimate and cap, staleness, Send to Relationships | Run one industry end to end (for example marine, Hibiscus Coast) and show the source for every claim. |

Each phase ends with typecheck, the unit tests, the Electron e2e suite, a CHANGES.md update, a commit, and a release through the self-updater once you approve the demo.

## 9. Questions for Zak before Phase 1

1. **Signing:** option A (free self-signed certificate) or B (Apple Developer, US$99/yr)?
2. **Canvas:** Excalidraw, with Tally's three fonts as presets and no arbitrary system fonts or free weight control? Or pay for tldraw?
3. **Click ripples outside Tally windows:** worth an Accessibility permission?
4. **Keys:** move them into individual Keychain items (recommended, needs signing A or B)?
5. **People vs contacts:** keep Relationships `people` separate from prospect `contacts` (proposed, since their purposes differ), with "Send to Relationships" linking them?
