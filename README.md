# Astris Field Kit

A pocket film-production helper for **ASTRIS PRODUCTIONS**, a one-person film and photography studio in Canberra. It covers pre-production and the shoot day: lighting diagrams, shot design, calculators, a sun and moon planner, colour tools, storyboards, a shot list, a slate, call sheets, gear checklists and a printable Shoot Pack.

It is an installable web app (PWA). Everything is stored on the device, and every tool works offline after the first visit.

## How it is organised

The **Shoot Plan** is the heart of the app. Everything else either feeds it or comes out of it.

| No. | Section | What it does |
| --- | --- | --- |
| 01 | Shoot Plan | One top-down plan per set-up (scene, with scene number and camera notes). Place talent, furniture, marks, cameras, monitors, lights, modifiers, mics, wireless, recorders, home base and other areas. Switch between **All, Camera, Lighting, Audio and Base** views; other layers dim. Each set-up has an **environment** (white studio, dark studio, daylight, overcast, natural or warm indoor, low light, or custom walls, floor, reflectance, ambient light and sun). Lights have fixture type, diffusion, power, colour, height, tilt, beam and distance. People can stand, sit on a chair, couch or bench, kneel, lie or walk, and a couch can be filled with any number of people. Readouts show exposure through the chosen camera and how every camera frames every person. The live three.js view looks through a real camera's settings. Each view exports as PNG. |
| 02 | Cameras | Camera A, B, C and more. **Any camera or lens**: pick the kind of camera (mirrorless, DSLR, cinema, camcorder, action, phone) and describe its mount, sensor, ISO, recording options and ports, or start from a shortcut; describe any lens the same way. Lenses adapt by flange distance, so any lens that can physically be adapted gets an adapter. **Save a rig** (camera, settings, lens, every part and connection) and choose **Use my rig** next time. Each camera has its own body, lens (only lenses that fit the mount, or that fit through a real adapter), aperture, shutter angle or speed, ISO/EI, ND, white balance and tint, focus, resolution, frame rate, codec, bit depth, chroma, picture profile, colour space, stabilisation, height and tilt. The settings check each other (Log forces 10-bit where the codec allows, frame rates follow resolution, apertures follow the lens at that focal length). A **simulated image** updates live: true field of view, thin-lens depth of field, exposure, motion blur, white balance, ISO noise, Log curves and a monitoring LUT. An exposure meter combines the light on the subject with the settings, and **Balance exposure** fixes it without touching the shutter. **Add Equipment** puts cages, handles, rails, arms, monitors, follow focus, matte boxes, filters, supports, batteries, cables and audio on the rig, and **Auto Connect** proposes only compatible links for you to approve. Each camera has a **3D rig builder**: detailed models in a realistic or blueprint look, every part sitting on the mounting point it is connected to (tripods the right way up), tap a part to see where it can go and tap or drag it there, plus turn, take off, replace, remove and PNG. The **camera department setup sheet** (PDF or print) is here too. |
| 03 | Gear | Your kit with names, make and model, quantity, power and every **input and output** (connector, signal, mount standard, voltage, phantom power). The **Connections** tab is a production overview: ports in use, cables needed against cables owned, missing and incompatible items, Auto Connect for everything, connecting by hand, notes and a port map per item. The **equipment list builds itself** from your gear, the plan and the connections: stands, sandbags, cables, batteries, chargers, cards, headphones and home-base kit. CSV downloads, and one tap adds it to the packing checklist. |
| 04 | Shot List | Scenes and shots with lens, movement, status, filters and CSV export. Shots link to set-ups. |
| 05 | Storyboard | Frames from compositions, images or a sketch tool, with captions, dialogue and timing. |
| 06 | Call Sheet | Date, call time, location with a map link, a daylight summary, cast and crew, schedule and notes. |
| 07 | Packing Checklist | Tick off the generated equipment list and template groups as you pack. |
| 08 | Shoot Pack | A4 PDF of everything: the plan for each set-up with all four department views, kit tables, equipment list, gear with inputs and outputs, connections, call sheet and more. Also PNG, CSV and JSON downloads. |

### Toolkit

Sun and Moon planner, eighteen calculators, Shot Designer, Colour Studio, Slate and Astris Awards live in the Toolkit tab.

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

## Accounts and sync (optional)

Without any setup the app saves everything on the device. To let people sign in and have their plans, saved rigs, cameras, lenses and plan images follow them to every device, connect a free Supabase project once:

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. In **SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates one table with row level security, so each person can only ever read and change their own rows, and a private `images` storage bucket with the same rule.
3. In **Authentication → URL Configuration**, set the **Site URL** to your Vercel address and add `https://your-site.vercel.app/account` to **Redirect URLs** (sign-in links and password resets land there).
4. In **Vercel → Project Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase: **Project Settings → API**). Redeploy. For local development, copy `.env.example` to `.env.local`.

The **Account** page then offers sign in, create account, an emailed sign-in link and password reset.

How sync behaves:

- Everything saves on the device first and works offline; changes upload a few seconds later, when the app goes to the background, and when the connection returns.
- If only one device changed a plan, that version wins. If two devices changed the same plan before syncing, **both are kept**: the other device's version arrives as "(from another device)". Replaced and deleted plans are backed up on the device first.
- Saved rigs, cameras and lenses merge item by item. Deletions travel to other devices.
- App settings (theme, units, location) stay per device.
- The Supabase client loads only when accounts are switched on, so the app stays small without them.

## Data and privacy

All data lives in the browser's IndexedDB on the device: production plans, settings and uploaded images (downscaled to 1600 px). Nothing is sent anywhere unless accounts are switched on and you sign in (see above). **My Production Plans** lists every plan to open, rename, duplicate, download or delete. Plans save as you work, and the app asks the browser to keep its storage persistent.

Every stored plan carries a schema version. When an update changes the stored shape, the original is backed up on the device before it is upgraded. A daily copy and a copy before every delete are kept too (eight per plan), and **restoring always creates a new plan**, so nothing is overwritten. Back up to another device from **Shoot Pack → Backup** (JSON with images). Imports never overwrite; a plan that already exists arrives as a copy.

## Decisions

- **Routing and state:** React Router with lazy routes, Zustand stores persisted to IndexedDB through `idb`, with debounced writes that flush when the page is hidden.
- **Lazy loading:** three.js, Leaflet and jsPDF load only when their tool is opened or a PDF is generated. First load is about 375 KB of JavaScript before compression.
- **Offline:** Workbox precaches the app, fonts and lazy chunks. OpenStreetMap tiles are cached as they are viewed (up to 400 tiles, 30 days). The planner, compass dial and all sun and moon maths work without tiles.
- **Sun and moon:** SunCalc 2, which reports angles in degrees and supports a time-zone offset. Times are computed for the civil day in the chosen time zone (default `Australia/Sydney`).
- **PDF fonts:** jsPDF needs TrueType, and fontsource ships WOFF. `scripts/woff-to-ttf.mjs` converts the self-hosted Inter Tight and IBM Plex Mono files at build time (`prebuild`), so PDF text is real, selectable vector text in the brand fonts. The same fonts are embedded when SVGs are rasterised, so award cards and frame PNGs match the app.
- **Images:** replaced or orphaned images are cleaned up at start-up rather than deleted immediately, so duplicated and imported projects keep their images.
- **Equipment list rules:** counts use the busiest set-up, because kit moves between set-ups. Each light or modifier needs a stand and each stand a sandbag; each camera position needs support; batteries are one per device plus a spare; cards are two per recording device. Every line says why it is there.
- **Camera simulation:** physically based where the maths is standard: field of view from sensor and focal length; thin-lens depth of field and blur disc size; exposure from aperture, shutter, ISO and ND against a reference of f/2.8, 1/48 s, ISO 800 at about 200 lux; motion blur from shutter time; the makers' published S-Log3, C-Log, C-Log2, C-Log3, V-Log and F-Log2 curves. Approximations: sensor noise, white balance colour, the look of standard and cine profiles, HLG and BMD Film, colour spaces and the monitoring LUT. The app labels which is which. Flicker warnings assume Australian 50 Hz mains.
- **Camera and lens data:** published mounts, sensor sizes, ISO ranges, dual native ISOs, resolutions and frame rates, codecs, ports, sizes and weights for the bodies and lenses in the database, plus generic DSLR, mirrorless and cinema bodies. Check unusual modes against your manual.
- **Compatibility:** Auto Connect only joins matching mounts and standards (lens mounts, filter threads, battery types, NATO, 1/4-20, shoes), checks voltages and phantom power, keeps each item on one camera's rig, puts supports under the rig and never forces a link. It proposes; you approve all or some.
- **Room light:** bright walls are modelled as an integrating sphere, E = ρ / (1 − ρ) × Φ / A, so a white room adds real fill to the readouts and the 3D view. Ambient light and sun are in lux.
- **Lighting maths:** a planning model, not a light meter. Illuminance falls off with the square of distance, light outside the beam falls to 10% spill, flags pass 8% and diffusion 55%, bounce cards return 60% of what reaches them, and light from behind the subject counts less at the face. Exposure is relative to a single 100% key at 2 m.
- **Theme:** light by default, with an On-set dark theme. The device's colour-scheme preference is used only on first run.
- **Units and copy:** metric by default with an imperial toggle, 24-hour time, Australian English.

## Verification

- **Unit tests:** 115 tests across sync decisions (two devices, conflicts, deletes), saved rigs, described cameras and lenses, flange-based adapting, camera settings and Log curves, exposure balance and ND, Auto Connect compatibility, environments and room bounce, poses and framing, calculators, sun and moon, colour, photometry, gear and the equipment list, shot-size classification, timecode, slate and backup helpers, including the reference values in the brief (hyperfocal 10.83 m, 39.6° horizontal FOV, 10-stop ND to 8.2 s, 1/48 s at 24 fps, 45 GB per hour at 100 Mbps).
- **Accessibility:** axe-core reports no WCAG 2.1 AA or best-practice violations on any of the 25 routes, in both themes. Focus rings, keyboard reordering, a skip link, focus-trapped sheets and `aria-live` results are in place, and reduced motion is respected.
- **Lighthouse 12 (home):** performance 94 on the simulated mobile profile and 100 on desktop; accessibility, best practices and SEO 100.
- **PWA:** Lighthouse 12 no longer has a PWA category, so it was audited with Lighthouse 11.7.1: installable manifest, maskable icon, splash screen, themed address bar, viewport and content width all pass.
- **Offline:** after one online visit, every route, the 3D view and PDF generation work with the network off.

## Known limits

- The call sheet does not fetch a weather forecast, because the app is offline-first. Sun and moon conditions are calculated on the device, with a free-text field for the forecast.
- The simulated camera image is a planning aid. Brightness follows the plan's lights and room, so check exposure with the camera's own tools on the day.
- The 3D view is stylised: posed mannequins for talent, simple shapes for cameras on tripods, mics on stands, monitors, kit and walls, and tinted floor areas for home base and the rest. Camera view is lit only by your plan's lights; orbit adds a soft work light so the layout reads. It shows direction, ratio and colour, not physically exact light transport.
- Codec bitrates, pixel pitches and gel values are typical figures. Check them against your camera and gel swatch book.
- Map tiles need a connection the first time an area is viewed.
- Wake Lock needs a browser that supports it (iOS Safari 16.4 or later). Vibration on clap is Android only.
