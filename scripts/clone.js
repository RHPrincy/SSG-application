#!/usr/bin/env node
// Options:
//   --max=N     maximum number of pages (default 500)
//   --js        also keep the JavaScript
//   --headful   show the browser

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const positional = argv.filter((a) => !a.startsWith('--'));

let startUrl = positional[0];
if (!startUrl) {
  console.error('Usage: node clone.js <url> [output-folder] [--max=N] [--js] [--headful]');
  process.exit(1);
}
if (!/^https?:\/\//i.test(startUrl)) startUrl = 'https://' + startUrl;

const getFlag = (name, def) => {
  const f = flags.find((x) => x.startsWith('--' + name + '='));
  return f ? f.split('=')[1] : def;
};

const ORIGIN = new URL(startUrl).origin;
const OUT_DIR = path.resolve(positional[1] || new URL(startUrl).hostname);
const MAX_PAGES = parseInt(getFlag('max', '500'), 10);
const KEEP_JS = flags.includes('--js');
const HEADFUL = flags.includes('--headful');
const ASSET_CONCURRENCY = 8;

// ------------------------------------------------ local path of an asset
// (logic duplicated browser-side in page.evaluate -> keep in sync)
function assetLocalPath(absUrl) {
  const url = new URL(absUrl);
  let base = url.origin === ORIGIN ? '' : '_external/' + url.hostname + '/';
  let p = url.pathname.replace(/^\/+/, '');
  if (p === '' || p.endsWith('/')) p += 'index';
  if (url.search) {
    let h = 0;
    for (let i = 0; i < url.search.length; i++) h = (h * 31 + url.search.charCodeAt(i)) >>> 0;
    const tag = '__q' + h.toString(36);
    const slash = p.lastIndexOf('/');
    const dot = p.lastIndexOf('.');
    p = dot > slash ? p.slice(0, dot) + tag + p.slice(dot) : p + tag;
  }
  return base + p;
}

// ---------------------------------------------- rewriting CSS url()/@import
function rewriteCss(text, cssAbsUrl) {
  const found = [];
  const resolve = (raw) => {
    raw = raw.trim().replace(/^['"]|['"]$/g, '');
    if (/^data:/i.test(raw) || raw === '') return null;
    let abs;
    try { abs = new URL(raw, cssAbsUrl).href; } catch { return null; }
    if (!/^https?:/i.test(abs)) return null;
    const local = assetLocalPath(abs);
    found.push({ abs, local });
    return '/' + local;
  };
  text = text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, _q, u) => {
    const r = resolve(u);
    return r ? `url(${r})` : m;
  });
  text = text.replace(/@import\s+(['"])([^'"]+)\1/g, (m, _q, u) => {
    const r = resolve(u);
    return r ? `@import "${r}"` : m;
  });
  return { text, found };
}

// ---------------------------------------------- discover chunks referenced in JS
// Built bundles load other chunks via string literals (e.g. "assets/Chunk-xxx.js"
// or "/assets/Chunk-xxx.css"). These never appear in the HTML, so we scan the JS
// text and enqueue them. The literals are already correct root-relative paths, so
// no rewriting is needed — only discovery + download.
function findJsAssets(text, jsAbsUrl) {
  const found = [];
  const seen = new Set();
  const re = /(?:\.{0,2}\/)?assets\/[A-Za-z0-9_.\-]+\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|json)/gi;
  let m;
  while ((m = re.exec(text))) {
    let abs;
    try { abs = new URL(m[0], jsAbsUrl).href; } catch { continue; }
    if (!/^https?:/i.test(abs) || new URL(abs).origin !== ORIGIN) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    found.push({ abs, local: assetLocalPath(abs) });
  }
  return found;
}

function writeFile(localPath, data) {
  const full = path.join(OUT_DIR, localPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

// ============================================================================
(async () => {
  console.log(`Origin    : ${ORIGIN}`);
  console.log(`Output    : ${OUT_DIR}`);
  console.log(`Max pages : ${MAX_PAGES}${KEEP_JS ? '  (+JS)' : '  (HTML/CSS only)'}\n`);

  const browser = await chromium.launch({ headless: !HEADFUL });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pagesSeen = new Set();
  const pageQueue = [startUrl.replace(/#.*$/, '')];
  const assets = new Map();        // abs -> local
  let count = 0;

  // --------------------------------------------------------- 1) crawl pages
  while (pageQueue.length && count < MAX_PAGES) {
    const url = pageQueue.shift();
    const key = url.replace(/\/$/, '');
    if (pagesSeen.has(key)) continue;
    pagesSeen.add(key);
    count++;

    process.stdout.write(`[${count}] ${url} ... `);
    try {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      }

      // rewrite the DOM to root-relative paths + return assets & pages
      const result = await page.evaluate(({ origin, keepJs }) => {
        const assets = [];
        const pages = [];
        const baseURI = document.baseURI;
        const isHttp = (u) => /^https?:\/\//i.test(u);
        const toAbs = (u) => { try { return new URL(u, baseURI).href; } catch { return null; } };

        const assetLocal = (abs) => {
          const url = new URL(abs);
          let base = url.origin === origin ? '' : '_external/' + url.hostname + '/';
          let p = url.pathname.replace(/^\/+/, '');
          if (p === '' || p.endsWith('/')) p += 'index';
          if (url.search) {
            let h = 0;
            for (let i = 0; i < url.search.length; i++) h = (h * 31 + url.search.charCodeAt(i)) >>> 0;
            const tag = '__q' + h.toString(36);
            const slash = p.lastIndexOf('/');
            const dot = p.lastIndexOf('.');
            p = dot > slash ? p.slice(0, dot) + tag + p.slice(dot) : p + tag;
          }
          return base + p;
        };
        const pageLocal = (abs) => {
          const url = new URL(abs);
          let p = url.pathname;
          const last = p.split('/').pop();
          if (p.endsWith('/')) p += 'index.html';
          else if (!/\.[a-z0-9]+$/i.test(last)) p += '/index.html';
          return p.replace(/^\/+/, '') || 'index.html';
        };
        const assetRef = (abs) => { const l = assetLocal(abs); assets.push({ abs, local: l }); return '/' + l; };

        const cssText = (text) => text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
          if (/^data:/i.test(u)) return m;
          const abs = toAbs(u); if (!abs || !isHttp(abs)) return m;
          return 'url(' + assetRef(abs) + ')';
        });

        document.querySelectorAll('base').forEach((b) => b.remove());

        // keep only the <link> tags useful for rendering (CSS, icons, fonts)
        const SKIP_REL = /\b(canonical|alternate|preconnect|dns-prefetch|prerender|prev|next|me|pingback|search|author|license|help)\b/i;
        document.querySelectorAll('link[href]').forEach((el) => {
          const rel = (el.getAttribute('rel') || '').toLowerCase();
          if (SKIP_REL.test(rel)) { el.remove(); return; }
          // modulepreload / preload[as=script] reference the app's JS bundles:
          // keep and capture them with --js, otherwise drop them
          const isScriptPreload = /\bmodulepreload\b/.test(rel) || el.getAttribute('as') === 'script';
          if (isScriptPreload && !keepJs) { el.remove(); return; }
          if (isHttp(el.href)) el.setAttribute('href', assetRef(el.href));
        });

        // JavaScript: removed by default; with --js keep both external and inline scripts
        document.querySelectorAll('script').forEach((el) => {
          if (!keepJs) { el.remove(); return; }
          if (el.src && isHttp(el.src)) el.setAttribute('src', assetRef(el.src));
          // inline scripts (no src) are kept as-is (e.g. Vite module bootstrap)
        });

        document.querySelectorAll('img[src]').forEach((el) => {
          if (isHttp(el.src)) el.setAttribute('src', assetRef(el.src));
        });
        const fixSrcset = (el) => {
          const ss = el.getAttribute('srcset'); if (!ss) return;
          el.setAttribute('srcset', ss.split(',').map((part) => {
            const seg = part.trim().split(/\s+/);
            const abs = toAbs(seg[0]);
            if (abs && isHttp(abs)) seg[0] = assetRef(abs);
            return seg.join(' ');
          }).join(', '));
        };
        document.querySelectorAll('img[srcset], source[srcset]').forEach(fixSrcset);
        document.querySelectorAll('source[src], video[src], audio[src]').forEach((el) => {
          if (isHttp(el.src)) el.setAttribute('src', assetRef(el.src));
        });
        document.querySelectorAll('video[poster]').forEach((el) => {
          const abs = toAbs(el.getAttribute('poster'));
          if (abs && isHttp(abs)) el.setAttribute('poster', assetRef(abs));
        });
        document.querySelectorAll('use, image').forEach((el) => {
          const raw = el.getAttribute('href') || el.getAttribute('xlink:href'); if (!raw) return;
          const abs = toAbs(raw);
          if (abs && isHttp(abs)) { el.setAttribute('href', assetRef(abs)); el.removeAttribute('xlink:href'); }
        });
        document.querySelectorAll('style').forEach((el) => { el.textContent = cssText(el.textContent); });
        document.querySelectorAll('[style]').forEach((el) => {
          const v = el.getAttribute('style');
          if (v && v.includes('url(')) el.setAttribute('style', cssText(v));
        });

        document.querySelectorAll('a[href], area[href]').forEach((el) => {
          const abs = el.href;
          if (!isHttp(abs)) return;
          if (new URL(abs).origin !== origin) return;          // external link: leave as is
          const last = new URL(abs).pathname.split('/').pop();
          const m = last.match(/\.([a-z0-9]+)$/i);
          if (m && !/^html?$/i.test(m[1])) {                   // file (pdf...) -> asset
            el.setAttribute('href', assetRef(abs));
          } else {
            el.setAttribute('href', '/' + pageLocal(abs));
            pages.push(abs.replace(/#.*$/, ''));
          }
        });

        return { assets, pages };
      }, { origin: ORIGIN, keepJs: KEEP_JS });

      // rendered HTML (with links already rewritten)
      const html = await page.content();
      const u = new URL(url);
      let p = u.pathname;
      const last = p.split('/').pop();
      if (p.endsWith('/')) p += 'index.html';
      else if (!/\.html?$/i.test(last)) p += '/index.html';
      writeFile(p.replace(/^\/+/, '') || 'index.html', html);

      for (const pg of result.pages) {
        const k = pg.replace(/\/$/, '');
        if (!pagesSeen.has(k) && !pageQueue.includes(pg)) pageQueue.push(pg);
      }
      for (const a of result.assets) if (!assets.has(a.abs)) assets.set(a.abs, a.local);

      console.log(`OK  (+${result.pages.length} links, ${result.assets.length} assets)`);
    } catch (e) {
      console.log('FAILED: ' + e.message);
    }
  }

  if (pageQueue.length) console.log(`\n⚠  Limit of ${MAX_PAGES} pages reached, ${pageQueue.length} remaining ignored (increase --max).`);

  // ----------------------------------------------------- 2) download assets
  console.log(`\nDownloading assets (${assets.size})...`);
  const done = new Set();
  let ok = 0, fail = 0;

  async function download(abs, local) {
    if (done.has(abs)) return;
    done.add(abs);
    try {
      const resp = await context.request.get(abs, { timeout: 30000 });
      if (!resp.ok()) { fail++; return; }
      let body = await resp.body();
      const ctype = resp.headers()['content-type'] || '';
      if (/\.css($|\?)/i.test(local) || /text\/css/i.test(ctype)) {
        const { text, found } = rewriteCss(body.toString('utf8'), abs);
        body = Buffer.from(text, 'utf8');
        for (const f of found) if (!assets.has(f.abs)) assets.set(f.abs, f.local);
      } else if (/\.m?js($|\?)/i.test(local) || /javascript/i.test(ctype)) {
        // follow chunks referenced inside JS (dynamic imports, Vite __vite__mapDeps)
        for (const f of findJsAssets(body.toString('utf8'), abs)) {
          if (!assets.has(f.abs)) assets.set(f.abs, f.local);
        }
      }
      writeFile(local, body);
      ok++;
    } catch { fail++; }
  }

  const processed = new Set();
  let pending = [...assets.entries()];
  while (pending.length) {
    for (let i = 0; i < pending.length; i += ASSET_CONCURRENCY) {
      const batch = pending.slice(i, i + ASSET_CONCURRENCY);
      await Promise.all(batch.map(([abs, local]) => { processed.add(abs); return download(abs, local); }));
    }
    pending = [...assets.entries()].filter(([abs]) => !processed.has(abs));
  }

  await browser.close();
  console.log(`\n✔ Done: ${pagesSeen.size} pages, ${ok} assets (${fail} failures)`);
  console.log(`\nTo preview:\n  node serve.js "${path.relative(process.cwd(), OUT_DIR) || OUT_DIR}"`);
})();
