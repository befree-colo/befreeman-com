import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { colors } from '@befreeman/design-system';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const require = createRequire(import.meta.url);
type Font = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };
let fonts: Font[] | null = null;

async function loadFonts(): Promise<Font[]> {
  fonts ??= [
    { name: 'Inter', data: await readFile(require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff')), weight: 400, style: 'normal' },
    { name: 'Inter', data: await readFile(require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff')), weight: 700, style: 'normal' },
    { name: 'Space Grotesk', data: await readFile(require.resolve('@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff')), weight: 700, style: 'normal' },
  ];
  return fonts;
}

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

/** 1200×630 social preview in the site's dark palette. */
export async function renderOgImage(input: { eyebrow: string; title: string; subtitle: string }): Promise<Buffer> {
  const p = colors.dark;
  const tree = h(
    'div',
    {
      // Satori uses content-box sizing: 1200×630 minus the padding below.
      width: 1040,
      height: 486,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 80px',
      backgroundColor: p.surface,
      backgroundImage: `radial-gradient(circle at 85% 15%, ${p.accent}66 0%, transparent 45%), radial-gradient(circle at 10% 95%, ${p['accent-2']}44 0%, transparent 40%)`,
      color: p.ink,
      fontFamily: 'Inter',
    },
    [
      h('div', { display: 'flex', fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color: p.accent }, input.eyebrow),
      h('div', { display: 'flex', flexDirection: 'column', gap: 24, width: 1040 }, [
        h('div', { display: 'block', width: 1040, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: input.title.length > 40 ? 60 : 80, lineHeight: 1.08, letterSpacing: -2 }, input.title),
        h('div', { display: 'block', width: 1000, fontSize: 30, color: p['ink-muted'], lineHeight: 1.35 }, input.subtitle.length > 140 ? `${input.subtitle.slice(0, 139)}…` : input.subtitle),
      ]),
      h('div', { display: 'flex', alignItems: 'center', gap: 16, fontSize: 26, color: p['ink-muted'] }, [
        h('div', { display: 'flex', width: 44, height: 44, borderRadius: 12, backgroundColor: p.accent, color: p['accent-ink'], alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }, 'BF'),
        h('div', { display: 'flex' }, 'befreeman.com'),
      ]),
    ],
  );
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width: 1200, height: 630, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
