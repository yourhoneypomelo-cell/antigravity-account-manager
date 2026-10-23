/**
 * TOTP (Time-based One-Time Password) utilities based on RFC 6238 and RFC 4648 Base32.
 * Fully synchronous and offline, compatible with Google Authenticator.
 */

// Base32 RFC 4648 alphabet
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Clean user-entered TOTP secret key:
 * - Converts to uppercase
 * - Removes spaces, dashes, hyphens, colons, underscores and trailing padding '='
 */
export function cleanTotpSecret(rawSecret: string): string {
  if (!rawSecret) return "";
  return rawSecret.toUpperCase().replace(/[\s\-_=:]/g, "");
}

/**
 * Check if the cleaned secret is valid Base32 and not empty
 */
export function isValidTotpSecret(rawSecret: string): boolean {
  const clean = cleanTotpSecret(rawSecret);
  if (!clean || clean.length < 8) return false;
  for (let i = 0; i < clean.length; i++) {
    if (BASE32_ALPHABET.indexOf(clean[i]) === -1) {
      return false;
    }
  }
  return true;
}

/**
 * Decode Base32 string into byte array
 */
function base32Decode(cleanStr: string): Uint8Array {
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((cleanStr.length * 5) / 8));

  for (let i = 0; i < cleanStr.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanStr[i]);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${cleanStr[i]}`);
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return output;
}

/**
 * SHA-1 implementation in pure JS (RFC 3174)
 */
function sha1(bytes: Uint8Array): Uint8Array {
  function rotl(n: number, s: number): number {
    return (n << s) | (n >>> (32 - s));
  }

  const len = bytes.length;
  const words: number[] = [];
  for (let i = 0; i < len; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  words[len >>> 2] |= 0x80 << (24 - (len % 4) * 8);
  words[(((len + 8) >>> 6) << 4) + 15] = len * 8;

  let H0 = 0x67452301;
  let H1 = 0xefcdab89;
  let H2 = 0x98badcfe;
  let H3 = 0x10325476;
  let H4 = 0xc3d2e1f0;

  const W = new Int32Array(80);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = words[i + t] | 0;
    for (let t = 16; t < 80; t++) {
      W[t] = rotl(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;

    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (rotl(a, 5) + f + e + k + W[t]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
  }

  const out = new Uint8Array(20);
  const h = [H0, H1, H2, H3, H4];
  for (let i = 0; i < 5; i++) {
    out[i * 4] = (h[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
    out[i * 4 + 3] = h[i] & 0xff;
  }
  return out;
}

/**
 * HMAC-SHA1
 */
function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) {
    k = sha1(k);
  }
  const kPad = new Uint8Array(64);
  kPad.set(k);

  const iPad = new Uint8Array(64 + message.length);
  const oPad = new Uint8Array(64 + 20);

  for (let i = 0; i < 64; i++) {
    iPad[i] = kPad[i] ^ 0x36;
    oPad[i] = kPad[i] ^ 0x5c;
  }

  iPad.set(message, 64);
  const innerHash = sha1(iPad);
  oPad.set(innerHash, 64);
  return sha1(oPad);
}

/**
 * Generate 6-digit TOTP code from secret string
 * @param rawSecret Base32 secret string
 * @param timeSeconds Unix timestamp in seconds (default: current time)
 * @returns 6-digit string like "394102", or null if secret is invalid
 */
export function generateTotpCode(
  rawSecret: string,
  timeSeconds: number = Math.floor(Date.now() / 1000)
): { code: string; formatted: string } | null {
  const clean = cleanTotpSecret(rawSecret);
  if (!clean || clean.length < 8) return null;

  try {
    const keyBytes = base32Decode(clean);
    const epoch = Math.floor(timeSeconds / 30);
    const timeBuf = new Uint8Array(8);

    let temp = epoch;
    for (let i = 7; i >= 0; i--) {
      timeBuf[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    const hash = hmacSha1(keyBytes, timeBuf);
    const offset = hash[19] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, "0");
    const formatted = `${otp.slice(0, 3)} ${otp.slice(3)}`;

    return { code: otp, formatted };
  } catch {
    return null;
  }
}

/**
 * Returns remaining seconds until next TOTP code regeneration (1 - 30)
 */
export function getTotpRemainingSeconds(): number {
  const now = Math.floor(Date.now() / 1000);
  const rem = 30 - (now % 30);
  return rem === 0 ? 30 : rem;
}
