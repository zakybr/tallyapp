# CHANGES

Per-phase log for [FEATURES_BRIEF.md](FEATURES_BRIEF.md). The plan is in [PLAN.md](PLAN.md).

## Phase 2: Boards (30 Oct 2026)

### Built
- **Boards** in the sidebar (⌘6):
  - A library with thumbnails, search by name or tag, folders, favourites, templates, and trash with restore. Trashed boards are deleted for good after 30 days.
  - Import a `.tallyboard` file.
- **Editor:** an Excalidraw canvas (MIT) with infinite pan and zoom, grid and snap, every shape (rectangle, rounded rectangle, ellipse, diamond, line, arrow and connectors that stay attached, freehand), text, sticky notes, frames, group, align, distribute, layers, lock, duplicate, undo and redo, and paste. It works fully offline: its fonts are bundled.
- **Tally fonts and styles:**
  - **Heading** (Barlow Condensed), **Body** (General Sans) and **Label** (JetBrains Mono) buttons apply Tally's fonts to selected text.
  - Excalidraw's font picker still shows its own names for these slots: Lilita One is Barlow Condensed, Nunito is General Sans, Comic Shanns is JetBrains Mono.
  - Style presets: **Tally** (#0B0B0A ink, #F2EDE4 cream) and **Tally accent** (#D9711A), plus "Save current style as preset".
- **Media:**
  - **Add media** or drag in images, PDFs (pick the page) and videos (`.mp4` and QuickTime `.mov`, which play inline).
  - Everything is copied into the board's `assets/` folder, so moving the original never breaks a board.
  - A video copied to another board brings its file along.
- **Saving:**
  - Each board is a folder at `~/Library/Application Support/Tally/Boards/<id>/` containing `board.json`, `assets/`, `thumbnail.png` and `versions/`.
  - Autosave runs 800 ms after you stop editing, and saves are atomic.
  - **Versions:** named snapshots you can restore. Restoring saves the current state as a version first.
- **Templates:** save any board as a template ("Enquiry-to-revenue system"), then pick it under New board.
- **Links:** link a board to people and companies; it then shows on their pages.
- **Export:**
  - PNG or PDF, of the whole board or one per frame (frames work as slides).
  - A portable `.tallyboard` file (a zip of the folder) for backups or another Mac.

### Verified
- The QA run from the brief (`node scripts/qa-board.mjs <profile> <media> <shots>`):
  1. Drew every shape type with the real mouse and keyboard, applied a text style and a preset, and added an image, a PDF page, an MP4 and a QuickTime MOV.
  2. Quit and relaunched. All 15 elements came back, the arrow was still attached at both ends, both images reloaded, and both videos **played** (the MP4 to 1.2 s of 4 s, the MOV to 1.2 s of 3 s). The thumbnail and the snapshot were there.
- 69 unit tests (5 new for the board store: save and reload, snapshots, .tallyboard round trip, rejecting bad zips and path tricks, trash purge) and 11 e2e tests, including a new board flow across a restart.
- A code review found 4 issues, all fixed. For example, undoing a deleted image would have lost it on the next reopen.

### Notes
- Excalidraw lists a CDN as a fallback for its fonts. The app's security policy blocks it, so you may see harmless console messages. Every font loads from the bundled copy.
- Arbitrary system fonts and a free weight control aren't available. That's the Excalidraw trade-off noted in PLAN.md section 2.
- Present mode (frames as slides, laser pointer) is Phase 3.

## Phase 1: Relationships (29 Oct 2026)

### Built
- **Data** (migration 4): `people`, `interactions` (with "what they told me", "advice they gave" and "what I promised"), `promises`, `relationship_drafts`, and `external_ids` on companies and people for a later HubSpot/Notion sync. SQL lives in `src/main/db/relationships.ts`; stages, cadence and the writing rules are in `src/shared/relationships.ts`.
- **Cadence:** thank-you the same day, acted on advice around day 7, value touch around day 18, invite to share from about day 28, all counted from the meeting day. A follow-up comes 7 days after first contact, and a check-in 14 days after a pitch. Each person's cadence can be edited. Logging a planned touch moves the stage forward, never back. A next touch you set by hand holds until the next logged touch.
- **Screens:**
  - **Relationships** (⌘5) with **Due**, **Board** and **People** tabs. Due shows the suggested action, their last words and advice, and open promises. The Board has drag-and-drop stages and days since the last touch.
  - **Person page:** next touch, facts, interests, cadence, open promises (tick them off), timeline, the current draft and sent drafts, and a Privacy Act export and delete.
- **Drafting:**
  - A new `relationship_touch` agent writes from that person's notes only, with the voice kept in `.claude/skills/tally-relationship-touch/SKILL.md`.
  - The writing rules are enforced in code (`lintRelationship`): sign-off "Zak / Tally / tallynz.co"; no em dashes, exclamation marks, emoji, calendar links, guarantee or target language, hype words or US spelling; under 150 words; short paragraphs; no clipped-fragment or slogan endings.
  - The draft editor checks the rules live as you type. Copy, Open in Mail, and "I sent this" (logs the touch). Nothing is sent automatically.
  - **Pitch gate:** a pitch before "Invited to share" is refused in the main process. You can override once per person; the override is recorded on the person and on the draft.
- **Reminders:** a tally-mark icon in the menu bar with the due count and a menu of who's due; one notification each morning (default 08:00); open at login. All set in Settings → Reminders.
- **Release signing:** `scripts/release.mjs` signs with the "Tally Local Signing" certificate and refuses to publish an unsigned build unless run with `ALLOW_ADHOC=1`.

### Verified
- 64 unit tests: cadence, month-end dates, the pitch gate, promise splitting, the writing rules and AI tells, and the repository flow from first contact through to the day-7 touch coming due.
- 10 Electron e2e tests, including three new Relationships flows: add a person → log the meeting → draft → lint catches "!" → "I sent this" → next touch; the pitch-gate warning; Board and People.
- Demo profile: 8 fictional directors across all stages (`node scripts/seed-relationships.mjs <dir>`).
- Real drafter run: a thank-you to "Priya Fictional" that quoted her own words and kept her promise. Passed every rule; 15 s, about 6k tokens.
- A code review found 9 issues; all are fixed.

### You need to do
1. **Create the signing certificate** (one time, about 2 minutes): Keychain Access → menu **Keychain Access → Certificate Assistant → Create a Certificate…**
   - Name: `Tally Local Signing`, Identity Type: **Self Signed Root**, Certificate Type: **Code Signing** → Create.
   - Then double-click the new certificate → **Trust** → "When using this certificate": **Always Trust**.
   - Check it worked: `security find-identity -v -p codesigning` lists "Tally Local Signing".
2. **The first time a reminder fires, allow Notifications** for Tally.

### Not done yet / left for later
- The Home dashboard doesn't have a "touches due" card yet (it shows in the sidebar badge, the menu bar and the Due tab).
- Retention rules for Relationships people (Privacy Act IPP 9): only explicit delete and export exist so far.
- Not yet released through the updater: waiting for your demo approval and the signing certificate.
