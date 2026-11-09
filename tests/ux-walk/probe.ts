/**
 * `yarn ux:probe --url <path> [--email <persona>] [--click <selector>]… [--widths 390,1280 | --reflow]
 *  [--locales cs,en] [--base http://localhost:3100] [--out .ux-walk]`
 *
 * Measures one state of one page the way the `ux` agent does: as one persona, at a phone
 * and a laptop width, in both languages. Writes a screenshot and the probe results per
 * combination into `--out/<timestamp>/`, plus `bundle.json` and a one-screen `summary.md`,
 * and prints the summary. Without `--email` the page is probed signed out.
 *
 * Personas are the development seed's (`src/server/db/seed.ts`, `DEV_PERSONAS`).
 * Ported from deedmob's `yarn ux:probe`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { chromium, type Page } from '@playwright/test';
import { DEV_PASSWORD } from '../../src/server/db/devPersonas.ts';
import { runProbes, type ProbeResult } from './probes.ts';

const OPTIONS = {
  url: { type: 'string' },
  email: { type: 'string' },
  password: { type: 'string', default: DEV_PASSWORD },
  base: { type: 'string', default: 'http://localhost:3100' },
  widths: { type: 'string' },
  reflow: { type: 'boolean', default: false },
  locales: { type: 'string', default: 'cs,en' },
  click: { type: 'string', multiple: true, default: [] as string[] },
  out: { type: 'string', default: '.ux-walk' },
} satisfies ParseArgsOptionsConfig;

type Combination = {
  locale: string;
  width: number;
  screenshot: string;
  consoleErrors: string[];
  failedRequests: string[];
  probes: ProbeResult;
};

// Phone first: this app is used on phones and tablets far more than on laptops.
const DEFAULT_WIDTHS = '390,1280';
// WCAG AA on a 1280 px laptop: 1.4.10 Reflow at 320 px (400% zoom), 1.4.4 Resize Text at 640 px.
const REFLOW_WIDTHS = '320,640';

const viewportFor = (width: number) => ({ width, height: width < 600 ? 844 : 900 });

/** The dev server's own HMR client is not the page under walk. */
const isDevServerNoise = (text: string, sourceUrl: string) =>
  sourceUrl.includes('/@vite/client') ||
  text.startsWith('[vite]') ||
  text === 'WebSocket closed without opened.';

function collectPageErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !isDevServerNoise(message.text(), message.location().url)
    ) {
      consoleErrors.push(message.text().slice(0, 500));
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });
  return { consoleErrors, failedRequests };
}

function summarise(url: string, email: string | undefined, combinations: Combination[]) {
  const lines = [`# UX probe: ${url}`, '', `As: ${email ?? 'signed out'}`, ''];
  for (const {
    locale,
    width,
    screenshot,
    consoleErrors,
    failedRequests,
    probes,
  } of combinations) {
    const below24 = probes.tapTargets.filter((target) => target.level === 'below-24');
    lines.push(
      `## ${locale} · ${width}px — ${screenshot}`,
      '',
      `- measured: ${
        probes.scope
          ? `the open dialog \`${probes.scope.selector}\` "${probes.scope.name}" only`
          : 'the whole page'
      }`,
      `- axe serious/critical: ${probes.axe.length}${probes.axe
        .map(
          (v) =>
            `\n  - ${v.impact} ${v.id}: ${v.help} (${v.targets.length}× e.g. \`${v.targets[0]}\`)`,
        )
        .join('')}`,
      `- overflow: ${probes.overflow.length}${probes.overflow
        .map(
          (o) =>
            `\n  - ${o.kind} \`${o.selector}\` "${o.name}" (${
              o.kind === 'beyond-viewport'
                ? `spans ${o.left}…${o.right}px on a ${o.clientWidth}px screen`
                : `${o.scrollWidth} > ${o.clientWidth}`
            })`,
        )
        .join('')}`,
      `- tap targets under 24px: ${below24.length}${below24
        .map((t) => `\n  - \`${t.selector}\` "${t.name}" ${t.width}×${t.height}`)
        .join('')}; under 44px: ${probes.tapTargets.length - below24.length}`,
      `- icons flush against their text: ${probes.iconSpacing.length}${probes.iconSpacing
        .map((i) => `\n  - \`${i.selector}\` "${i.name}" gap ${i.gap}px`)
        .join('')}`,
      `- dense menus and popovers: ${probes.denseOverlays.length}${probes.denseOverlays
        .map(
          (d) =>
            `\n  - ${d.role} \`${d.selector}\` ${d.words} words, longest option ${d.longestOptionWords}`,
        )
        .join('')}`,
      `- focus: ${
        probes.focus
          ? `${probes.focus.order.length} stops; unreachable: ${
              probes.focus.unreachable.length
            }${probes.focus.unreachable.map((u) => `\n  - \`${u.selector}\` "${u.name}"`).join('')}${
              probes.focus.escapedTo
                ? `\n  - Tab leaves the dialog for \`${probes.focus.escapedTo.selector}\` "${probes.focus.escapedTo.name}"`
                : ''
            }; focus rings cut off: ${probes.focus.clippedRings.length}${probes.focus.clippedRings
              .map(
                (c) =>
                  `\n  - \`${c.selector}\` "${c.name}" by \`${c.clippedBy}\` (${Object.entries(
                    c.sides,
                  )
                    .map(([side, px]) => `${side} ${px}px`)
                    .join(', ')})`,
              )
              .join('')}`
          : 'not measured, a menu or popover is open (probe the page without it)'
      }`,
      `- layout shift: ${probes.layoutShift}`,
      `- console errors: ${consoleErrors.length}${consoleErrors
        .map((e) => `\n  - ${e.slice(0, 200)}`)
        .join('')}`,
      `- failed requests: ${failedRequests.length}${failedRequests.map((r) => `\n  - ${r}`).join('')}`,
      '',
    );
  }
  return lines.join('\n');
}

async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: OPTIONS });
  if (!values.url) {
    console.error(
      'Usage: yarn ux:probe --url <path> [--email <persona>] [--click <selector>]…',
    );
    return 2;
  }
  if (values.reflow && values.widths) {
    console.error('--reflow measures at 320 and 640 px; pass it or --widths, not both.');
    return 2;
  }
  const widths = (values.widths ?? (values.reflow ? REFLOW_WIDTHS : DEFAULT_WIDTHS))
    .split(',')
    .map(Number);
  const outDir = resolve(values.out, new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const combinations: Combination[] = [];
  try {
    for (const locale of values.locales.split(',')) {
      const context = await browser.newContext({
        viewport: viewportFor(390),
        baseURL: values.base,
      });
      // The app reads its language from localStorage before anything renders.
      await context.addInitScript((l) => {
        localStorage.setItem('zpevnak.locale', l);
      }, locale);
      const page = await context.newPage();
      if (values.email) {
        const response = await page.request.post('/trpc/auth.logIn', {
          data: { email: values.email, password: values.password },
        });
        if (!response.ok()) {
          throw new Error(`Could not log in as ${values.email}: ${response.status()}`);
        }
      }
      for (const width of widths) {
        await page.setViewportSize(viewportFor(width));
        const { consoleErrors, failedRequests } = collectPageErrors(page);
        await page.goto(values.url);
        for (const selector of values.click) {
          await page.locator(selector).first().click();
        }
        // Let the catalog sync, queries and enter transitions settle before measuring.
        await page.waitForTimeout(1_500);
        const screenshot = `${locale}-${width}.png`;
        await page.screenshot({ path: join(outDir, screenshot), fullPage: true });
        const probes = await runProbes(page);
        combinations.push({
          locale,
          width,
          screenshot,
          consoleErrors: [...consoleErrors],
          failedRequests: [...failedRequests],
          probes,
        });
        page.removeAllListeners('pageerror');
        page.removeAllListeners('console');
        page.removeAllListeners('response');
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const summary = summarise(values.url, values.email, combinations);
  await writeFile(
    join(outDir, 'bundle.json'),
    JSON.stringify({ ...values, combinations }, null, 2),
  );
  await writeFile(join(outDir, 'summary.md'), summary);
  console.log(summary);
  console.log(`\nWritten to ${outDir}`);
  return 0;
}

process.exitCode = await main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error);
  return 1;
});
