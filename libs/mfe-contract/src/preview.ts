/**
 * Signed preview overrides: `name@version` pairs that let a smoke test (or a
 * reviewer) load candidate versions before promotion. The Worker honors them only
 * with a valid, unexpired HMAC-SHA256 token. Web Crypto works in Node and Workers.
 */
export const PREVIEW_PARAMS = { override: 'mfe-override', exp: 'mfe-exp', token: 'mfe-token' } as const;

export interface PreviewOverride {
  name: string;
  version: string;
}

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseOverrides(value: string): PreviewOverride[] | null {
  const out: PreviewOverride[] = [];
  for (const part of value.split(',')) {
    const m = /^([a-z][a-z0-9-]*)@([0-9A-Za-z.+_-]{1,64})$/.exec(part.trim());
    if (!m?.[1] || !m[2]) return null;
    out.push({ name: m[1], version: m[2] });
  }
  return out.length ? out : null;
}

export function formatOverrides(overrides: PreviewOverride[]): string {
  return overrides.map((o) => `${o.name}@${o.version}`).join(',');
}

/** Query parameters for a signed preview valid for `ttlSeconds`. */
export async function signPreview(
  overrides: PreviewOverride[],
  secret: string,
  ttlSeconds = 600,
  now: number = Date.now(),
): Promise<Record<string, string>> {
  const override = formatOverrides(overrides);
  const exp = String(Math.floor(now / 1000) + ttlSeconds);
  return { [PREVIEW_PARAMS.override]: override, [PREVIEW_PARAMS.exp]: exp, [PREVIEW_PARAMS.token]: await hmacHex(secret, `${override}|${exp}`) };
}

export type PreviewVerdict =
  | { ok: true; overrides: PreviewOverride[] }
  | { ok: false; reason: 'missing' | 'malformed' | 'expired' | 'bad-signature' | 'no-secret' };

export async function verifyPreview(params: URLSearchParams, secret: string | undefined, now: number = Date.now()): Promise<PreviewVerdict> {
  const override = params.get(PREVIEW_PARAMS.override);
  const exp = params.get(PREVIEW_PARAMS.exp);
  const token = params.get(PREVIEW_PARAMS.token);
  if (!override && !exp && !token) return { ok: false, reason: 'missing' };
  if (!secret) return { ok: false, reason: 'no-secret' };
  const overrides = override ? parseOverrides(override) : null;
  if (!overrides || !exp || !/^\d+$/.test(exp) || !token) return { ok: false, reason: 'malformed' };
  if (Number(exp) * 1000 < now) return { ok: false, reason: 'expired' };
  const expected = await hmacHex(secret, `${override}|${exp}`);
  if (!timingSafeEqual(expected, token.toLowerCase())) return { ok: false, reason: 'bad-signature' };
  return { ok: true, overrides };
}
