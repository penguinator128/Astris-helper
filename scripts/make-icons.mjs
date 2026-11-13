// Renders PWA icons from inline SVG with headless Chromium.
// Run: PW_PATH=$(npm root -g)/playwright node scripts/make-icons.mjs  (any Playwright install works)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW_PATH ?? '/opt/node-tools/node_modules/playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

const star = (pad, bg, rx) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rx}" fill="${bg}"/>
  <g transform="translate(32 32) scale(${1 - pad}) translate(-32 -32)">
    <g stroke="#0B0B0C" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M32 12v40M12 32h40M17.9 17.9l28.2 28.2M46.1 17.9 17.9 46.1"/>
    </g>
    <circle cx="32" cy="32" r="7" fill="#FFC400" stroke="#0B0B0C" stroke-width="5"/>
  </g>
</svg>`;

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, svg: star(0, '#FFC400', 8) },
  { file: 'public/icons/icon-512.png', size: 512, svg: star(0, '#FFC400', 8) },
  { file: 'public/icons/icon-maskable-192.png', size: 192, svg: star(0.3, '#FFC400', 0) },
  { file: 'public/icons/icon-maskable-512.png', size: 512, svg: star(0.3, '#FFC400', 0) },
  { file: 'public/apple-touch-icon.png', size: 180, svg: star(0.12, '#FFC400', 0) },
];

mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(t.file, buf);
  console.log('wrote', t.file);
}
await browser.close();
