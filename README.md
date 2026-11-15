# Astris Field Kit

A pocket film-production helper for **ASTRIS PRODUCTIONS**, a one-person film and photography studio in Canberra. It covers pre-production and the shoot day: lighting diagrams, shot design, calculators, a sun and moon planner, colour tools, storyboards, a shot list, a slate, call sheets, gear checklists and a printable Shoot Pack.

It is an installable web app (PWA). Everything is stored on the device, and every tool works offline after the first visit.

## Tools

| No. | Tool | What it does |
| --- | --- | --- |
| 01 | Sun and Moon Planner | Map with camera and subject pins, bearing and distance, sun and moon direction lines, a day scrubber, golden and blue hour, all three twilights, moonrise and moonset, phase, a month calendar, shadow length and saved plans. Typed coordinates work without a network. |
| 02 | Lighting Diagram | Top-down plan with pan, zoom and snap. Subjects, camera with a field-of-view cone, walls, and twelve light and modifier types with power, kelvin, gel, size, height, tilt and spread. Undo and redo, lock, duplicate, nine presets, a sun-path overlay, key-to-fill ratio, exposure and colour-mix readouts, and a live three.js mannequin view from the camera or in orbit. |
| 03 | Shot Designer | Frame canvas in seven aspect ratios with ten guides, draggable silhouettes and props, automatic shot-size labels, angle and movement, lens field of view and background blur, palette and reference-image overlays. Sends frames to the storyboard or shot list. |
| 04 | Colour Studio | OKLCH harmonies and film looks around a must-have colour, palette extraction from a still (k-means, on device), a WCAG contrast checker and a per-scene colour script. |
| 05 | Calculators | Eighteen calculators, each with a "How this is calculated" section. See below. |
| 06 | Shot List | Table on desktop, cards on phones. Filter, sort, search, drag to reorder, bulk status, automatic numbering and CSV export. |
| 07 | Storyboard | Frames from compositions, images or a vector sketch tool, with caption, dialogue, size, movement, lens, duration and shot links. Drag to reorder. |
| 08 | Slate | Full-screen clapperboard with live time-of-day timecode, take counter, synthesised clap, flash, mirrored mode and screen wake lock. |
| 09 | Astris Awards | Ceremonies, categories, nominees and winners, SVG trophy cards exported as PNG, and an envelope reveal. |
| 10 | Call Sheet | Date, call time, location with a map link, a daylight summary from sun times, cast and crew, schedule and notes. |
| 11 | Gear Checklist | Template groups (camera, lenses, audio, lighting, batteries, media, accessories), ticked off per project. |
| 12 | Shoot Pack | Branded A4 PDF in portrait or landscape, PNG exports, and JSON backup and import. |

### Calculators

Exposure and ND, depth of field (classic, inverse, circle-of-confusion override), field of view (with video crops and inverse), hyperfocal table, subject distance, shutter angle, frame rate and slow motion, time lapse (with timer), stars (NPF and 500 rule, trail length), lens equivalence, light power and distance, colour temperature and gels, dolly zoom, anamorphic, storage and battery, script runtime, shadow length, and timecode (including drop-frame).

Sensor presets: Canon EOS R50V (APS-C, 22.3 × 14.9 mm, 1.6×), full frame, Super 35, Micro Four Thirds, 1-inch and custom. Each project remembers its own camera, lens, aperture, ISO and frame rate.

## Run, test and build

Requires Node `^20.19.0 || >=22.12.0`.

```bash
npm install
npm run dev        # local dev server
npm run check      # type-check, lint and unit tests
npm run build      # production build into dist/
npm run preview    # serve the production build, including the service worker
```

The service worker is only active in the production build, so test offline behaviour with `npm run build && npm run preview`.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite. The settings in `vercel.json` apply: build command `npm run build`, output directory `dist`, an SPA rewrite to `index.html`, no caching on `sw.js`, and long-lived caching for hashed assets.
4. Deploy. No environment variables or backend are needed.

## Project structure

```
src/
  app/            Shell (tab bar, desktop rail), router, project switcher
  brand/          Wordmark and star mark (replaceable, see below)
  components/     Blueprint panel, buttons, fields, stepper, slider, sheet, tabs
  lib/            Pure logic: calculators, sun and moon, colour, photometry,
                  timecode, backup, formatting. Unit-tested.
  modules/        One folder per tool
  store/          Zustand stores over IndexedDB (projects, settings, images)
  styles/         Design tokens, base, components, layout
scripts/          Icon renderer and WOFF-to-TTF converter
public/           Icons, favicon, wordmark.svg, TTF fonts for PDFs
```

## Replacing the logo

The wordmark is a single replaceable asset in three places:

- **App UI, slate and splash:** `src/brand/Wordmark.tsx` (`Wordmark` and `StarMark`). The splash in `index.html` repeats the star mark inline.
- **Static file:** `public/wordmark.svg`. Keep roughly a 7:1 ratio.
- **PDF:** `wordmark()` and `starMark()` in `src/modules/export/pdf/pack.ts` draw it as vectors.
- **App icons:** edit the SVG in `scripts/make-icons.mjs` and run `npm run icons` (needs a Playwright install; set `PW_PATH` to it if it is not at the default path).

## Data and privacy

All data lives in the browser's IndexedDB on the device: projects, settings and uploaded images (downscaled to 1600 px). Nothing is sent anywhere. Back up from **Shoot Pack → Backup**: export one project or all projects as JSON (images included), and import on another device. Imports never overwrite; a project that already exists arrives as a copy.

## Decisions

- **Routing and state:** React Router with lazy routes, Zustand stores persisted to IndexedDB through `idb`, with debounced writes that flush when the page is hidden.
- **Lazy loading:** three.js, Leaflet and jsPDF load only when their tool is opened or a PDF is generated. First load is about 375 KB of JavaScript before compression.
- **Offline:** Workbox precaches the app, fonts and lazy chunks. OpenStreetMap tiles are cached as they are viewed (up to 400 tiles, 30 days). The planner, compass dial and all sun and moon maths work without tiles.
- **Sun and moon:** SunCalc 2, which reports angles in degrees and supports a time-zone offset. Times are computed for the civil day in the chosen time zone (default `Australia/Sydney`).
- **PDF fonts:** jsPDF needs TrueType, and fontsource ships WOFF. `scripts/woff-to-ttf.mjs` converts the self-hosted Inter Tight and IBM Plex Mono files at build time (`prebuild`), so PDF text is real, selectable vector text in the brand fonts. The same fonts are embedded when SVGs are rasterised, so award cards and frame PNGs match the app.
- **Images:** replaced or orphaned images are cleaned up at start-up rather than deleted immediately, so duplicated and imported projects keep their images.
- **Lighting maths:** a planning model, not a light meter. Illuminance falls off with the square of distance, light outside the beam falls to 10% spill, flags pass 8% and diffusion 55%, bounce cards return 60% of what reaches them, and light from behind the subject counts less at the face. Exposure is relative to a single 100% key at 2 m.
- **Theme:** light by default, with an On-set dark theme. The device's colour-scheme preference is used only on first run.
- **Units and copy:** metric by default with an imperial toggle, 24-hour time, Australian English.

## Verification

- **Unit tests:** 72 tests across calculators, sun and moon, colour, photometry, shot-size classification, timecode, slate and backup helpers, including the reference values in the brief (hyperfocal 10.83 m, 39.6° horizontal FOV, 10-stop ND to 8.2 s, 1/48 s at 24 fps, 45 GB per hour at 100 Mbps).
- **Accessibility:** axe-core reports no WCAG 2.1 AA or best-practice violations on any of the 25 routes, in both themes. Focus rings, keyboard reordering, a skip link, focus-trapped sheets and `aria-live` results are in place, and reduced motion is respected.
- **Lighthouse 12 (home):** performance 94 on the simulated mobile profile and 100 on desktop; accessibility, best practices and SEO 100.
- **PWA:** Lighthouse 12 no longer has a PWA category, so it was audited with Lighthouse 11.7.1: installable manifest, maskable icon, splash screen, themed address bar, viewport and content width all pass.
- **Offline:** after one online visit, every route, the 3D view and PDF generation work with the network off.

## Known limits

- The call sheet does not fetch a weather forecast, because the app is offline-first. Sun and moon conditions are calculated on the device, with a free-text field for the forecast.
- The 3D view is a stylised mannequin with real-time spot lights and soft shadows. It shows direction, ratio and colour, not physically exact light transport.
- Codec bitrates, pixel pitches and gel values are typical figures. Check them against your camera and gel swatch book.
- Map tiles need a connection the first time an area is viewed.
- Wake Lock needs a browser that supports it (iOS Safari 16.4 or later). Vibration on clap is Android only.
