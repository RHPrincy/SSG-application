/**
 * Pre-render + deploy orchestration for a single site.
 *
 * Pipeline:
 *   1. Run the provided clone.js (reused as-is) against the Lovable URL,
 *      producing a static folder under data/output/<siteId>.
 *   2. Post-process the HTML so the *copy* is the canonical version:
 *      rewrite canonical / og:url / twitter:url and any lingering absolute
 *      Lovable URLs to the Vercel target, strip inherited noindex, and emit
 *      robots.txt + sitemap.xml (the SEO checklist from the README).
 *   3. Deploy the folder to Vercel via the CLI.
 *   4. Capture a baseline hash of the live Lovable render for later
 *      obsolescence checks, and persist timestamps on the site.
 *
 * Runs detached from the request (fire-and-forget); progress is streamed into
 * the in-memory job registry and polled by the client.
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  OUTPUT_DIR,
  CLONE_SCRIPT,
  VERCEL_BIN,
  VERCEL_TOKEN,
  VERCEL_ORG_ID,
  VERCEL_SCOPE,
} from './config';
import { appendLog, finishJob } from './jobs';
import { computeLiveHash } from './obsolescence';
import { updateSite } from './store';
import type { Site } from './types';

/** Spawn a command, stream its output into the job log, resolve with stdout. */
function run(
  jobId: string,
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    appendLog(jobId, `$ ${cmd} ${args.join(' ')}`);
    let stdout = '';
    // On Windows the Vercel CLI is a `.cmd` shim, and since Node 18.20/20.12
    // `spawn` refuses to launch `.cmd`/`.bat` files unless `shell: true`.
    // With a shell we must quote any argument that contains whitespace so the
    // shell does not split it into several tokens.
    const useShell = process.platform === 'win32';
    // Under a shell, every token (the executable included) is re-parsed by
    // cmd.exe, so any path containing whitespace — e.g. the Node binary at
    // "C:\Program Files\nodejs\node.exe" — must be quoted or it gets split.
    const quote = (s: string) => (/\s/.test(s) && !/^".*"$/.test(s) ? `"${s}"` : s);
    const spawnCmd = useShell ? quote(cmd) : cmd;
    const spawnArgs = useShell ? args.map(quote) : args;
    const child = spawn(spawnCmd, spawnArgs, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: useShell,
    });
    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      appendLog(jobId, s);
    });
    child.stderr.on('data', (d: Buffer) => appendLog(jobId, d.toString()));
    child.on('error', (err) => {
      appendLog(jobId, `Erreur: ${err.message}`);
      resolve({ code: -1, stdout });
    });
    child.on('close', (code) => resolve({ code: code ?? -1, stdout }));
  });
}

/** Recursively list files under `dir` matching `test`. */
async function walk(dir: string, test: (f: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, test)));
    else if (test(full)) out.push(full);
  }
  return out;
}

/**
 * Rewrite the static copy so it references the Vercel target instead of the
 * Lovable origin, and generate robots.txt + sitemap.xml. Best-effort: any
 * failure is logged but does not abort the deploy.
 */
async function postProcess(
  jobId: string,
  outDir: string,
  site: Site,
): Promise<void> {
  if (!site.vercelUrl) {
    appendLog(
      jobId,
      '⚠ Aucune URL Vercel configurée : canonical/og:url non réécrits, sitemap ignoré.',
    );
    return;
  }
  const lovableOrigin = new URL(site.lovableUrl).origin;
  const vercelOrigin = new URL(site.vercelUrl).origin;

  const htmlFiles = await walk(outDir, (f) => /\.html?$/i.test(f));
  appendLog(jobId, `Post-traitement SEO de ${htmlFiles.length} page(s)...`);

  for (const file of htmlFiles) {
    try {
      let html = await fs.readFile(file, 'utf8');
      // Point every absolute Lovable URL (canonical, og:url, JSON-LD @id...)
      // at the new domain.
      html = html.split(lovableOrigin).join(vercelOrigin);
      // Remove any inherited noindex directive that would keep the copy out
      // of the index.
      html = html.replace(
        /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/gi,
        '',
      );
      await fs.writeFile(file, html, 'utf8');
    } catch (e) {
      appendLog(jobId, `⚠ Réécriture ignorée pour ${path.basename(file)}: ${(e as Error).message}`);
    }
  }

  // sitemap.xml over the new domain: map each HTML file to a clean route.
  const urls = htmlFiles.map((f) => {
    let rel = path.relative(outDir, f).split(path.sep).join('/');
    rel = rel.replace(/index\.html$/i, '').replace(/\.html$/i, '').replace(/\/$/, '');
    return rel ? `${vercelOrigin}/${rel}` : vercelOrigin;
  });
  const uniqueUrls = Array.from(new Set(urls));
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    uniqueUrls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`;
  await fs.writeFile(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8').catch(() => {});

  const robots = `User-agent: *\nAllow: /\nSitemap: ${vercelOrigin}/sitemap.xml\n`;
  await fs.writeFile(path.join(outDir, 'robots.txt'), robots, 'utf8').catch(() => {});
  appendLog(jobId, '✔ Canonical/og réécrits, robots.txt + sitemap.xml générés.');
}

/** Deploy `outDir` to Vercel and return the deployment URL (or null). */
async function deployToVercel(
  jobId: string,
  outDir: string,
  site: Site,
): Promise<string | null> {
  if (!VERCEL_TOKEN) {
    appendLog(jobId, '✖ VERCEL_TOKEN absent : déploiement impossible (voir .env).');
    return null;
  }
  const args = ['deploy', outDir, '--prod', '--yes', '--token', VERCEL_TOKEN];
  if (VERCEL_SCOPE) args.push('--scope', VERCEL_SCOPE);

  // Target the existing project via env vars. `VERCEL_ORG_ID` +
  // `VERCEL_PROJECT_ID` make the CLI deploy INTO that project rather than
  // prompting / creating a new one. Without a project id we warn, because a
  // bare `deploy --yes` would spin up a brand-new project named after the
  // output folder.
  const env: Record<string, string> = {};
  if (VERCEL_ORG_ID) env.VERCEL_ORG_ID = VERCEL_ORG_ID;
  if (site.vercelProjectId) {
    env.VERCEL_PROJECT_ID = site.vercelProjectId;
    if (!VERCEL_ORG_ID) {
      appendLog(
        jobId,
        '⚠ VERCEL_PROJECT_ID défini mais VERCEL_ORG_ID absent : le ciblage du projet peut échouer.',
      );
    }
  } else {
    appendLog(
      jobId,
      '⚠ Aucun vercelProjectId pour ce site : Vercel risque de créer un nouveau projet au lieu de mettre à jour l’existant.',
    );
  }

  const { code, stdout } = await run(jobId, VERCEL_BIN, args, { env });
  if (code !== 0) {
    appendLog(jobId, `✖ Le déploiement Vercel a échoué (code ${code}).`);
    return null;
  }
  // The CLI prints the deployment URL; grab the last https:// token.
  const matches = stdout.match(/https:\/\/[^\s]+/g);
  const url = matches ? matches[matches.length - 1] : null;
  appendLog(jobId, url ? `✔ Déployé : ${url}` : '✔ Déploiement terminé.');
  return url;
}

/** Full pipeline for one site. Never throws — always finalises the job. */
export async function runPrerenderJob(jobId: string, site: Site): Promise<void> {
  const outDir = path.join(OUTPUT_DIR, site.id);
  try {
    appendLog(jobId, `=== Pré-rendu de « ${site.name} » (${site.lovableUrl}) ===`);

    // 1. Fresh output folder.
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });

    // 2. Clone (reused script, JS kept so scroll-revealed text & interactions
    //    are preserved).
    const clone = await run(jobId, process.execPath, [
      CLONE_SCRIPT,
      site.lovableUrl,
      outDir,
      '--js',
    ]);
    if (clone.code !== 0) throw new Error(`Le script de clonage a échoué (code ${clone.code}).`);

    // 3. SEO post-processing.
    await postProcess(jobId, outDir, site);

    // 4. Deploy.
    const deploymentUrl = await deployToVercel(jobId, outDir, site);
    if (!deploymentUrl) throw new Error('Déploiement Vercel non abouti.');

    // 5. Baseline hash of the live source for future obsolescence checks.
    appendLog(jobId, 'Capture de l’empreinte de la source Lovable...');
    const baselineHash = await computeLiveHash(site.lovableUrl);
    if (!baselineHash) {
      appendLog(jobId, '⚠ Empreinte non capturée : le statut restera « inconnu ».');
    }

    const now = new Date().toISOString();
    await updateSite(site.id, {
      lastDeploy: now,
      lastDeployUrl: deploymentUrl,
      baselineHash: baselineHash ?? undefined,
      lastStatus: baselineHash ? 'up-to-date' : 'unknown',
      lastCheckedAt: now,
      lastError: undefined,
    });

    appendLog(jobId, '=== Terminé avec succès ===');
    finishJob(jobId, 'success', { deploymentUrl });
  } catch (err) {
    const message = (err as Error).message || 'Erreur inconnue.';
    appendLog(jobId, `=== ÉCHEC : ${message} ===`);
    await updateSite(site.id, { lastError: message }).catch(() => {});
    finishJob(jobId, 'failed', { error: message });
  }
}
