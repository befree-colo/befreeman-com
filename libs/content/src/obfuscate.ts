/**
 * Reversible, non-cryptographic obfuscation for the contact email so the raw
 * address never appears in HTML or JSON. It defeats naive scrapers, not humans.
 */
const KEY = 'befreeman';

function xor(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return out;
}

function toBase64(s: string): string {
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}

function fromBase64(s: string): string {
  return typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
}

export function encodeContact(email: string): string {
  return toBase64(xor(email.split('').reverse().join('')));
}

export function decodeContact(token: string): string {
  return xor(fromBase64(token)).split('').reverse().join('');
}
