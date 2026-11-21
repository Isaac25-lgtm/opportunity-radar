// Captures the product screenshots used on the home page (public/product/card-*.jpg)
// from a LOCAL dev server, so marketing images always show the real product.
//
// Usage:
//   npx wrangler dev --port 8787            (in another terminal, after `npx vite build`)
//   OR_SESSION=<session cookie of a local demo user with a career profile> \
//     node scripts/capture-product-shots.mjs [baseUrl]
//
// Only run against local data. Never point this at production user accounts.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const session = process.env.OR_SESSION;
if (!session) {
  console.error('Set OR_SESSION to the session cookie of a local demo user.');
  process.exit(1);
}

const browser = await chromium.launch();

/** Screenshot the left part of the first listing card on a results page. */
async function captureFirstListing(name, path, { signedIn }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  if (signedIn) await ctx.addCookies([{ name: 'or_session', value: session, url: base }]);
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle' });
  const box = await page.locator('article').first().boundingBox();
  if (!box) throw new Error(`No listing found on ${path}`);
  await page.screenshot({
    path: `public/product/${name}.jpg`,
    type: 'jpeg',
    quality: 82,
    clip: { x: box.x, y: box.y, width: Math.round(box.width * 0.72), height: Math.round(box.height) },
  });
  await ctx.close();
  console.log('saved', name);
}

await captureFirstListing('card-career', '/app/opportunities?view=career', { signedIn: true });
await captureFirstListing('card-academic', '/opportunities?category=scholarship,fellowship,research_grant', {
  signedIn: false,
});
await captureFirstListing('card-business', '/opportunities?category=tender,rfp,rfq,eoi', { signedIn: false });
await browser.close();
