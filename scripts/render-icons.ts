/**
 * Renders the PNG app icons from the SVGs in public/. Run after changing an icon:
 *   node scripts/render-icons.ts
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const pub = new URL('../public/', import.meta.url).pathname;
const targets = [
  { svg: 'favicon.svg', out: 'pwa-192.png', size: 192 },
  { svg: 'favicon.svg', out: 'pwa-512.png', size: 512 },
  { svg: 'maskable.svg', out: 'maskable-512.png', size: 512 },
  // iOS draws its own rounded corners and needs a full square.
  { svg: 'maskable.svg', out: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { svg, out, size } of targets) {
    await page.setViewportSize({ width: size, height: size });
    const markup = readFileSync(pub + svg, 'utf8');
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
    );
    await page.screenshot({ path: pub + out, omitBackground: true });
    console.log(`public/${out}`);
  }
} finally {
  await browser.close();
}
