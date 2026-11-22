// Renders each seeded person's CV through the app's own print view, as an A4 PDF and a PNG preview.
//
//   node scripts/capture-sample-cvs.mjs <seed.json> <outDir> [baseUrl]
//
// <seed.json> comes from scripts/seed-sample-personas.mjs. Local servers only.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [seedFile, outDir, base = 'http://127.0.0.1:8787'] = process.argv.slice(2);
if (!seedFile || !outDir) throw new Error('Usage: node scripts/capture-sample-cvs.mjs <seed.json> <outDir>');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Local servers only.');
mkdirSync(outDir, { recursive: true });

const people = JSON.parse(readFileSync(seedFile, 'utf8')).filter((p) => p.cvId);
const browser = await chromium.launch();
for (const p of people) {
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'or_session', value: p.cookie, url: base }]);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    globalThis.print = () => {}; // the print view opens the dialog automatically; not needed here
  });
  await page.goto(`${base}/app/cvs/${p.cvId}/print`, { waitUntil: 'networkidle' });
  await page.locator('.cv-paper').first().waitFor();
  await page.emulateMedia({ media: 'print' });
  const file = `${String(people.indexOf(p) + 1).padStart(2, '0')}-${p.key}`;
  await page.pdf({
    path: join(outDir, `${file}.pdf`),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page
    .locator('.cv-paper')
    .first()
    .screenshot({ path: join(outDir, `${file}.png`) });
  await ctx.close();
  console.log(`rendered ${p.name}`);
}
await browser.close();
