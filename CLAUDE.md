# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A Dutch rehabilitation/stretching web app called **Stretch** (`index.html`). It is a single-file SPA with no build step — everything lives in one HTML file (~4500 lines). Deployed on Vercel at https://revalidatie-app.vercel.app/ with auto-deploy from GitHub (`cubestern/revalidatie-app`).

Password protection: `pleasenietkapotmaken` (client-side, sessionStorage).

## Deployment

```bash
git add index.html
git commit -m "..."
git push   # Vercel auto-deploys from main branch
```

There is no build, no compile step, no dev server. Open `index.html` directly in a browser to preview locally.

The only serverless function is `api/transcript.js` (YouTube transcript fetching). It runs on Vercel's Node.js runtime via the `youtube-transcript` npm package. `vercel.json` is intentionally minimal (`{"version": 2}`) — do not add explicit builds config or the API routes break.

## Architecture

**Single HTML file (`index.html`) structure:**
1. `<head>` — Google Fonts (Nunito), all CSS (~800 lines)
2. `<body>` — All screen HTML as `<div class="screen" id="XxxScreen">` divs, shown/hidden via `display: block/none`
3. `<script>` — All JavaScript (~2500 lines), no external dependencies

**Screen system:** `showScreen('name')` toggles `.active` class on `#nameScreen` divs and updates bottom nav active state. The `screenToNavIndex` map must be updated when adding nav items.

**Current nav order (index 0–4):** Home → Search → Favorites → Progress → Settings

**Data sources:**
- `exercises.json` — primary exercise database (fetched at runtime via `fetch('./exercises.json')`)
- `exerciseDatabase` — inline JS array fallback if fetch fails
- `customExercises` — stored in `localStorage('customExercises')` as JSON array
- `favoriteIds` — stored in `localStorage('favoriteExercises')` as JSON array of IDs

**Exercise object shape** (from `exercises.json`):
```js
{
  exercise, equipment, steps, cues_feel, good_for,
  tag_goal: [],      // 'mobility','rehab','strength','balance','relax','trend'
  tag_area: [],      // body area slugs
  tag_feel: [],      // 'stiff_tight','stressed_tense', etc.
  tag_intensity: '', // 'low'|'medium'|'high'
  tag_equipment: [], tag_pattern: [], tag_contra: [], tag_time_cost: ''
}
```

Custom exercises added by the user use `id: 'custom-...'` or `id: 'yt-...'` (YouTube import).

**Recommender system:** `recommender.js` is a standalone ES module (not currently imported by `index.html` — the recommendation logic is re-implemented inline in the script section using a similar scoring approach).

## Design language

Uses the **friendly-minimalism** skill: green tonal palette (hue-50 through hue-900), Nunito font, same-hue shadows, generous border-radii. All color tokens are CSS custom properties on `:root` and `[data-theme="dark"]`:

```css
--bg, --bg-card, --text, --text-secondary, --text-muted,
--border, --accent, --accent-soft,
--shadow-card, --shadow-elevated,
--hue-50 through --hue-900
```

Dark mode is toggled via `document.documentElement.setAttribute('data-theme', 'dark')` and persisted in `localStorage('theme')`. Dark mode overrides are a block of `[data-theme="dark"] .classname` rules — always add new dark mode styles there, not inline.

## Key JS sections (by comment header)

- `// Add Custom Exercise` — form handling + localStorage persistence
- `// Favorites System` — `favoriteIds` Set, `toggleFavorite()`, `renderFavorites()`
- `// Survey / Quick Check-in System` — swipeable card with scoring
- `// ===== Search =====` — `loadSearchExercises()`, `searchExercises()`, `toggleSearchExercise()`
- `// YouTube Import` — `fetchYoutubeTranscript()`, `parseExercisesFromTranscript()`, `saveAllYoutubeExercises()`
- Workout flow: `startWorkout()` → timer loop → `nextExercise()` → `completeWorkout()`

## Gotchas

- The workout screen uses `height: 100vh; overflow: hidden` with a flex column. The bottom bar (`workout-bottom`) is `flex-shrink: 0` and sticky. Do not break this layout when editing workout UI.
- `allExercises` is populated asynchronously by `loadSearchExercises()` which merges `exercises.json` + `customExercises`. Code that needs all exercises must wait for this or re-call it.
- `screenToNavIndex` in `showScreen()` must stay in sync with actual nav item order in the HTML.
- The `vercel.json` must stay as `{"version": 2}` only — adding `builds` breaks the `/api/transcript` route.
