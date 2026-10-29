# Features brief: Relationships, Boards, Research

Saved verbatim from Zak's brief (29 Oct 2026). This file governs the work on these three modules. PLAN.md records how it maps onto the existing app.

---

You are working in the repo for "Tally", my personal macOS desktop app for running Tally (Tally Marketing Limited), a one-person Auckland marketing agency. It already has some prospecting features (research agent, cold email and call script drafting). Read this whole brief, save it as FEATURES_BRIEF.md in the repo root, and follow it for all work below.

I am adding three modules:
1. Relationships: a long-term networking pipeline for directors I approach as a curious young entrepreneur, where the pitch only comes about a month in.
2. Boards: a Miro-style canvas for diagrams and screen recordings that I can show people.
3. Research: an Apollo-style finder for leading NZ companies by industry, with company and industry briefings and a suggested opening call and email.

=====================================================================
PHASE 0: INSPECT AND PLAN (stop after this)
=====================================================================
1. Work out the stack (Swift/SwiftUI, Electron, Tauri or other), how data is stored now, how the existing research agent calls Claude, where API keys live, and how navigation is structured. Don't assume. Read the code.
2. List what already exists that these modules can reuse (contacts, companies, research agent, drafting).
3. For Boards, evaluate and recommend one canvas approach for this stack:
   - tldraw (check its current licence terms for a private internal app before choosing; it handles images, video, fonts and custom shapes well)
   - Excalidraw (MIT; would need a custom shape for local video)
   - native SwiftUI canvas only if the app is native and a web canvas would be clearly worse
   In a native app, a web canvas can sit in a WKWebView with a bridge for saving files.
4. Write PLAN.md covering the data model, file layout, libraries with licences, the permissions needed (Screen Recording, Microphone, Camera), and anything that needs a paid API key. Stop and show me PLAN.md.

=====================================================================
MODULE 1: RELATIONSHIPS
=====================================================================
Purpose: I approach directors for advice or a visit, not a sale. The first month is relationship only. The app has to remember exactly what each person said and tell me when the next touch is due.

Data
- Person: name, role, company (link to Research company if it exists), phone, email, LinkedIn URL, how we met or who introduced us, tags (industry, region), personal interests they mentioned.
- Stage, in order:
  Identified > First contact sent > Visit or call booked > Met > Thank-you sent > Acted on their advice > Value touch sent > Invited to share what I'm building > Pitched > Client / Advisor only / Parked
- Interactions: dated log entries (met, call, email, text, LinkedIn), with free notes plus three structured fields:
  "What they told me" (their words), "Advice they gave", "What I promised to do".
- Next touch date and what it is. Default cadence after a meeting: thank-you same day, "acted on your advice" update around day 7, value touch around day 18, then open the "what I'm building" conversation from about day 28. Cadence is editable per person.

Views
- Today: everyone whose next touch is due or overdue, with the suggested action and their last notes on screen so I can write the message without searching.
- Pipeline board: columns by stage, drag to move, card shows days since last touch.
- Person page: timeline of interactions, open promises (anything I said I'd do and haven't logged), and a "draft next touch" button.

Drafting (uses the existing Claude integration)
- Drafts are built from that person's own notes: the thank-you names one specific thing they said, the day-7 message reports what I did with their advice, the value touch offers something useful with no ask.
- No pitching before the "Invited to share" stage. If I ask for a pitch earlier, warn me once and let me override.
- Writing rules for every draft: NZ English, short lines with blank lines between, no em dashes, no exclamation marks, no emoji, no calendar links, no guarantee or "agreed target" language, plain sign-off "Zak / Tally / tallynz.co". Warm and curious, not salesy. No AI tells (three-fragment staccato rhythm, aphorism closers).
- Drafts are copied or opened in Mail. Never send anything automatically.

Reminders
- macOS notification each morning listing due touches. Menu-bar count of due items.

=====================================================================
MODULE 2: BOARDS
=====================================================================
Purpose: an infinite canvas for explaining systems to clients and directors, recording walkthroughs, and keeping multiple saved boards.

Canvas features
- Infinite pan and zoom, grid toggle, snap.
- Shapes: rectangle, rounded rectangle, ellipse, diamond, line, arrow and connector (connectors stay attached when shapes move), freehand pen, sticky notes, frames (named sections that can be used as slides).
- Text: font family, size, weight, colour, alignment. Include the Tally fonts (serif headings, monospace uppercase labels) as presets plus system fonts.
- Style presets: a "Tally" preset with near-black #0B0B0A, warm cream #F2EDE4, amber #D9711A as the only accent. Save my own presets.
- Media: drag in images, PDFs (first page or chosen page), and local videos (mp4/mov) that play inline on the canvas. Also paste from clipboard.
- Select, group, align, distribute, layer order, lock, duplicate, copy between boards, undo/redo.
- Templates I can save from any board (for example "Enquiry-to-revenue system").

Saving
- Each board is a folder on disk: ~/Library/Application Support/Tally/Boards/<board-id>/ containing board.json and an assets/ folder. Media is copied into assets so boards don't break when the original file moves.
- Autosave on change (debounced), plus named version snapshots I can restore.
- Board library: grid of thumbnails, search by name and tag, folders, favourites, duplicate, delete to trash with restore.
- Optional link from a board to a Person or Company, so it shows on their page.
- Export: PNG and PDF (whole board or per frame), and a portable .tallyboard file (zip of the folder) for backup or moving machines.

Present and record
- Present mode: steps through frames full screen, laser pointer, hide UI.
- Screen recording built in: record the board window, a chosen window, or the full screen, with microphone audio, optional camera bubble (moveable, circular), cursor highlight and click ripples, and pause/resume. Use the platform's native capture (ScreenCaptureKit on macOS, or the stack's equivalent). Ask for Screen Recording, Microphone and Camera permissions only when first needed and explain why in the prompt.
- Recordings save as MP4 (H.264) into the board's assets, appear in a Recordings list on that board, can be trimmed at the start and end, renamed, and dropped onto the canvas or exported.

=====================================================================
MODULE 3: RESEARCH (NZ COMPANY FINDER)
=====================================================================
Purpose: pick an industry and region, get the leading NZ companies in it, and for each one get a company briefing, who to contact, and a suggested opening call and email. Also an industry primer so I can learn the sector before I call.

Inputs
- Industry (free text or presets: marine, aviation, horticulture, seafood, forestry, food processing, construction, HVAC, tourism and hire, motorhomes, pools), region, size signal (employees, locations), and "exclude existing contacts".

Sources, legal and public only
- NZ Companies Office and NZBN via their official APIs (api.business.govt.nz; I'll add the subscription keys): legal name, status, incorporation date, directors and shareholders, registered address, industry code.
- Google Places API: listing, address, phone, website, review count and rating, hours.
- The company's own website: fetch and read it, respecting robots.txt.
- Claude with web search for news, industry context and recent events, with source URLs kept for every claim.
- Do NOT scrape LinkedIn or any site whose terms forbid it. Do not guess or pattern-generate personal email addresses. Only store emails and phones that are published by the business or in a public register, and record where each came from.

Per company output (saved to the company record)
- Snapshot: what they sell, size signals, locations, ownership, how long trading.
- People: directors from the register, plus any names and roles published on their own site, each with source.
- Presence check: website tracking tags found in the page source (gtag, GTM, dataLayer, fbq, ttq, AW- tags, other analytics), contact path (form on /contact, tappable phone and email, broken links), Google listing completeness, social links. State only what was actually observed, with the date.
- Opportunities: two or three specific, sourced observations a director would care about.
- Approach: which person to contact first, and whether this is a Relationships approach (curious, ask for help or a visit) or a direct sales approach.
- Suggested opening call (short, natural, ends in one question) and opening email (under 150 words, one ask, subject under six words, opens with a specific sourced observation, plain sign-off). Same writing rules as Relationships.
- Verification flags: any claim the outreach depends on is marked "check before sending" with what to check. Unverified items are labelled UNVERIFIED, never stated as fact.

Industry primer (one per industry, cached and refreshable)
- How the industry makes money, seasonality, main buyer types, the language they use, the big players, recent news, regulations worth knowing, and five good questions to ask a director in that industry. Sources listed.

Workflow
- Results table: company, region, size signal, presence score, last researched date, status. Sort, filter, shortlist.
- "Send to Relationships" creates the Person and Company and sets stage to Identified.
- Cache everything with a researched-on date; show staleness and allow a refresh. Show estimated API cost before a large batch and cap batch size in settings.

=====================================================================
SHARED RULES
=====================================================================
- Everything stays local on my Mac by default. API keys in the macOS Keychain, not in files or the repo.
- Optional later: export or sync Persons and Companies to HubSpot or Notion. Build the data model so this is possible, but don't build the sync now.
- No automatic sending of email, texts or LinkedIn messages, ever.
- Match the app's existing design. If there is none: near-black, warm cream and amber, serif headings, monospace uppercase labels, thin corner brackets. No purple or blue gradients, no glassmorphism, no generic SaaS look.

=====================================================================
BUILD ORDER AND QA
=====================================================================
Phase 1: Relationships (data, views, drafting, reminders). Stop and demo.
Phase 2: Boards canvas, saving, library, export. Stop and demo.
Phase 3: Boards recording and present mode. Stop and demo.
Phase 4: Research (sources, company output, primer, send to Relationships). Stop and demo.

At the end of each phase:
1. Build passes, no type errors, existing features still work.
2. Seed realistic test data (fictional names only) and walk through the main flows yourself.
3. For Boards: create a board with every shape type, text styles, an image, a video and a recording; quit and relaunch; confirm everything reloads and plays.
4. For Research: run one industry end to end and show me the sources for every claim.
5. Write CHANGES.md listing what was built, what's left, and any keys or permissions I need to set up.
