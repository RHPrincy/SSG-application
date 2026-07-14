/**
 * Obsolescence detection.
 *
 * Approach (and its limits — see README):
 *   We render the live Lovable page in a real browser (same tech as clone.js),
 *   extract the *visible text* (body.innerText), normalise it, and hash it.
 *   Comparing that hash to the one captured during the last successful prerender
 *   tells us whether the Vercel copy is still current.
 *
 * Why visible text and not raw HTML:
 *   A SPA's raw HTML is nearly empty, and its rendered HTML changes on every
 *   load for reasons unrelated to content — CSP nonces, hydration markers,
 *   randomised element ids, hashed bundle filenames in <script src>. Hashing
 *   that would flag the site "obsolete" constantly (false positives).
 *   Visible text is far more stable and is exactly what SEO/crawlers care about.
 *
 * Remaining limits (surfaced as "statut inconnu" rather than a wrong badge):
 *   - Only the entry URL is checked, not every crawled page.
 *   - A/B tests, feature flags or rotating content can change the text without
 *     a real "edit", producing a false "obsolete".
 *   - If the render fails/times out, we return null → the UI shows "inconnu".
 */
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

/** Collapse whitespace so trivial formatting diffs don't change the hash. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function hashText(text: string): string {
  return createHash('sha256').update(normalise(text), 'utf8').digest('hex');
}

/**
 * Render `url` and return a stable hash of its visible text, or null if the
 * page could not be rendered (caller should treat null as "unknown").
 */
export async function computeLiveHash(url: string): Promise<string | null> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    }
    // Give scroll-reveal / late hydration a brief moment to settle.
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body?.innerText || '');
    const normalised = normalise(text);
    // Guard against an empty/blocked render being treated as valid content.
    if (normalised.length < 20) return null;
    return hashText(normalised);
  } catch {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
