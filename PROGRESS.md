# Tally app — progress

Personal prospecting desktop app for Tally Marketing Limited (Zak). Electron + Vite + React + TS + Tailwind v4,
Claude Agent SDK in main, SQLite via better-sqlite3. Source of truth for the method: `.claude/skills/tally-*`.

## Phases

- [x] **1. Scaffold + theme** — electron-vite shell, tokens (`src/renderer/src/styles/index.css`), sidebar, empty screens,
      tally-mark icon (`npm run icon`), unsigned arm64 .dmg (`npm run dist:mac`) verified to launch (`node scripts/smoke-packaged.mjs`).
- [ ] 2. Data
- [ ] 3. Agent plumbing
- [ ] 4. Research + score
- [ ] 5. Prepare + contact
- [ ] 6. Polish + package

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

## Commands

    npm run dev        # hot-reload app
    npm run build      # bundle to out/
    npm run typecheck
    npm test           # vitest unit tests
    npm run e2e        # Playwright Electron smoke test
    npm run dist:mac   # release/Tally-<v>-arm64.dmg
