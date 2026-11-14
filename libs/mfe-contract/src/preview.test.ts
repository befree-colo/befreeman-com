import { describe, expect, it } from 'vitest';
import { parseOverrides, signPreview, verifyPreview } from './preview';

const SECRET = 'test-secret';

describe('signed preview overrides', () => {
  it('round-trips a valid token', async () => {
    const params = new URLSearchParams(await signPreview([{ name: 'timeline', version: '1.2.0-abc' }], SECRET));
    expect(await verifyPreview(params, SECRET)).toEqual({ ok: true, overrides: [{ name: 'timeline', version: '1.2.0-abc' }] });
  });
  it('rejects tampered overrides, wrong secrets, and expired tokens', async () => {
    const params = new URLSearchParams(await signPreview([{ name: 'timeline', version: '1' }], SECRET));
    const tampered = new URLSearchParams(params);
    tampered.set('mfe-override', 'timeline@2');
    expect(await verifyPreview(tampered, SECRET)).toEqual({ ok: false, reason: 'bad-signature' });
    expect(await verifyPreview(params, 'other')).toEqual({ ok: false, reason: 'bad-signature' });
    const old = new URLSearchParams(await signPreview([{ name: 'timeline', version: '1' }], SECRET, 60, Date.now() - 3_600_000));
    expect(await verifyPreview(old, SECRET)).toEqual({ ok: false, reason: 'expired' });
  });
  it('reports missing, malformed, and unconfigured states', async () => {
    expect(await verifyPreview(new URLSearchParams(), SECRET)).toEqual({ ok: false, reason: 'missing' });
    expect(await verifyPreview(new URLSearchParams('mfe-override=bad value&mfe-exp=1&mfe-token=x'), SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(await verifyPreview(new URLSearchParams('mfe-override=a@1'), undefined)).toEqual({ ok: false, reason: 'no-secret' });
  });
  it('parses multiple overrides and rejects junk', () => {
    expect(parseOverrides('timeline@1,ui@2.0.0-x')).toEqual([{ name: 'timeline', version: '1' }, { name: 'ui', version: '2.0.0-x' }]);
    expect(parseOverrides('../etc@1')).toBeNull();
    expect(parseOverrides('a@../../x')).toBeNull();
  });
});
