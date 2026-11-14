/**
 * befreeman release tool.
 *
 *   release publish <achievements|timeline|skills|ui|content> [--version <v>] [--dist <dir>] [--skip-existing]
 *   release promote <name> <version> --base-url <url>      (content: `promote content <version>`)
 *   release rollback <name> [version]
 *   release init --ui <v> --content <v> [--remote <name>@<v> ...]
 *   release status
 *   release preview-link <name> <version>   (prints a signed preview query string; needs PREVIEW_SECRET)
 *
 * Targets: --local (default; the storage `wrangler dev` serves) or --remote [--env staging].
 * Smoke checks need PREVIEW_SECRET (same value as the Worker secret). `--skip-smoke` exists
 * only for rollback drills and prints a warning.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTENT_DIST, REMOTE_REGISTRY, UI_DIST, isRegisteredRemote } from '@befreeman/mfe-contract/registry';
import { ReleaseError, init, promote, promoteContent, publish, publishContent, readLive, rollback } from './release';
import type { ArtifactName, SmokeCheck } from './release';
import { playwrightSmoke } from './smoke';
import { signPreview } from '@befreeman/mfe-contract/preview';
import { wranglerStores } from './stores';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const EDGE = join(ROOT, 'apps/edge');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    version: { type: 'string' },
    'skip-existing': { type: 'boolean', default: false },
    'base-url': { type: 'string' },
    local: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    env: { type: 'string' },
    ui: { type: 'string' },
    content: { type: 'string' },
    'remote-version': { type: 'string', multiple: true },
    'skip-smoke': { type: 'boolean', default: false },
    dist: { type: 'string' },
  },
});

const [command, name, version] = positionals;
const mode = values.remote ? 'remote' : 'local';
const bucket = values.env === 'staging' ? 'befreeman-artifacts-staging' : 'befreeman-artifacts';
const stores = wranglerStores({ cwd: EDGE, bucket, mode, ...(values.env ? { env: values.env } : {}) });

function defaultVersion(project: string): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, project, 'package.json'), 'utf8')) as { version?: string };
  const git = (args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  let sha = 'nogit';
  let dirty = false;
  try {
    sha = git(['rev-parse', '--short=7', 'HEAD']);
    dirty = git(['status', '--porcelain']).length > 0;
  } catch {
    /* not a git checkout */
  }
  return `${pkg.version ?? '0.0.0'}-${sha}${dirty ? `-dirty${Date.now().toString(36)}` : ''}`;
}

const projectFor = (n: string) => (n === 'ui' ? 'libs/ui-components' : `apps/remote-${n}`);
const distFor = (n: string) => join(ROOT, n === 'ui' ? UI_DIST : REMOTE_REGISTRY[n as keyof typeof REMOTE_REGISTRY].dist);

function smokeFor(): SmokeCheck {
  if (values['skip-smoke']) {
    console.warn('⚠ --skip-smoke: promoting WITHOUT a smoke check (drills only)');
    return async () => [];
  }
  const baseUrl = values['base-url'];
  const secret = process.env['PREVIEW_SECRET'];
  if (!baseUrl || !secret) throw new ReleaseError('promote needs --base-url and the PREVIEW_SECRET env var for the smoke check', 'invalid');
  return playwrightSmoke(baseUrl.replace(/\/$/, ''), secret);
}

function assertArtifact(n: string | undefined): asserts n is ArtifactName {
  if (!n || (n !== 'ui' && !isRegisteredRemote(n))) throw new ReleaseError(`expected one of: ${[...Object.keys(REMOTE_REGISTRY), 'ui'].join(', ')}`, 'invalid');
}

async function main() {
  console.log(`[release] target: ${mode}${values.env ? ` (${values.env})` : ''}`);
  switch (command) {
    case 'publish': {
      if (name === 'content') {
        const c = await publishContent(stores, join(ROOT, CONTENT_DIST)).catch((e: unknown) => {
          if (values['skip-existing'] && e instanceof ReleaseError && e.code === 'duplicate-version') return null;
          throw e;
        });
        console.log(c ? `✔ published content ${c.version} → ${c.url}` : '↷ content already published');
        return;
      }
      assertArtifact(name);
      const v = values.version ?? defaultVersion(projectFor(name));
      try {
        const res = await publish(stores, name, v, values.dist ?? distFor(name), { source: defaultVersion(projectFor(name)) });
        console.log(`✔ published ${res.name}@${res.version} (${res.files} files)`);
      } catch (e) {
        if (values['skip-existing'] && e instanceof ReleaseError && e.code === 'duplicate-version') console.log(`↷ ${name}@${v} already published`);
        else throw e;
      }
      console.log(`VERSION=${v}`);
      return;
    }
    case 'promote': {
      if (name === 'content') {
        if (!version) throw new ReleaseError('promote content <version>', 'invalid');
        const { next } = await promoteContent(stores, { version, url: `/content/content.${version}.json` });
        console.log(`✔ content ${next.content.version} is live`);
        return;
      }
      assertArtifact(name);
      if (!version) throw new ReleaseError('promote <name> <version>', 'invalid');
      const { previous, next } = await promote(stores, name, version, smokeFor());
      const was = name === 'ui' ? previous.ui.version : previous.remotes[name]?.version;
      console.log(`✔ ${name}: ${was ?? '(none)'} → ${version} is live`);
      void next;
      return;
    }
    case 'rollback': {
      assertArtifact(name);
      const { previous, next } = await rollback(stores, name, version);
      const from = name === 'ui' ? previous.ui.version : previous.remotes[name]?.version;
      const to = name === 'ui' ? next.ui.version : next.remotes[name]?.version;
      console.log(`✔ rolled back ${name}: ${from} → ${to}`);
      return;
    }
    case 'init': {
      if (!values.ui || !values.content) throw new ReleaseError('init needs --ui <v> --content <v>', 'invalid');
      const remotes: Record<string, string> = {};
      for (const pair of values['remote-version'] ?? []) {
        const [n, v] = pair.split('@');
        if (n && v) remotes[n] = v;
      }
      const m = await init(stores, { ui: values.ui, content: { version: values.content, url: `/content/content.${values.content}.json` }, remotes });
      console.log('✔ live manifest created:\n' + JSON.stringify(m, null, 2));
      return;
    }
    case 'preview-link': {
      const secret = process.env['PREVIEW_SECRET'];
      if (!name || !version || !secret) throw new ReleaseError('preview-link <name> <version> needs PREVIEW_SECRET', 'invalid');
      const page = name === 'ui' ? '/' : isRegisteredRemote(name) ? REMOTE_REGISTRY[name].page : '/';
      console.log(`${page}?${new URLSearchParams(await signPreview([{ name, version }], secret, 3600)).toString()}`);
      return;
    }
    case 'status': {
      console.log(JSON.stringify(await readLive(stores), null, 2));
      return;
    }
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof ReleaseError ? `✖ ${error.message}` : error);
  process.exitCode = 1;
});
