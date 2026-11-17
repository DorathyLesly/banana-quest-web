/**
 * TOTP (Time-based One-Time Password) library
 * Uses Web Crypto API only — compatible with Cloudflare Workers and browsers.
 * Implements RFC 6238 (TOTP) and RFC 4226 (HOTP).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Uint8Array to a base32 string (RFC 4648).
 */
function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * Decode a base32-encoded string to a Uint8Array.
 */
function base32Decode(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/=+$/, '').toUpperCase();
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate a random 20-byte TOTP secret, returned as a base32 string.
 */
export async function generateTOTPSecret(): Promise<string> {
  const buffer = new Uint8Array(20);
  crypto.getRandomValues(buffer);
  return base32Encode(buffer);
}

/**
 * Convert a counter value to an 8-byte big-endian Uint8Array.
 */
function counterToBytes(counter: number): Uint8Array {
  const buffer = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  return buffer;
}

/**
 * Compute HMAC-SHA1 using Web Crypto API.
 */
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(key),
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new Uint8Array(message));
  return new Uint8Array(signature);
}

/**
 * Generate a TOTP code for a given base32-encoded secret and optional time.
 * Uses HMAC-SHA1, 30-second period, 6-digit output (RFC 6238).
 */
export async function generateTOTP(secret: string, time?: number): Promise<string> {
  const period = 30;
  const digits = 6;

  const currentTime = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(currentTime / period);

  const keyBytes = base32Decode(secret);
  const counterBytes = counterToBytes(counter);

  const hmac = await hmacSha1(keyBytes, counterBytes);

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify a TOTP code against a base32-encoded secret.
 * Allows ±1 time window for clock drift (checks 3 windows total).
 */
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const period = 30;
  const currentTime = Math.floor(Date.now() / 1000);

  for (let offset = -1; offset <= 1; offset++) {
    const windowTime = currentTime + offset * period;
    const expected = await generateTOTP(secret, windowTime);
    if (expected === code) {
      return true;
    }
  }

  return false;
}

/**
 * Generate the otpauth:// URI for QR code scanning.
 * Compatible with Google Authenticator, Authy, etc.
 */
export function getTOTPUri(
  secret: string,
  username: string,
  issuer: string = 'Jungle Digits'
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedUsername = encodeURIComponent(username);
  const label = `${encodedIssuer}:${encodedUsername}`;

  return (
    `otpauth://totp/${label}` +
    `?secret=${secret}` +
    `&issuer=${encodedIssuer}` +
    `&algorithm=SHA1` +
    `&digits=6` +
    `&period=30`
  );
}

/**
 * Generate an array of single-use backup codes.
 * Returns 8 codes, each 8 alphanumeric characters.
 */
export function generateBackupCodes(): string[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeCount = 8;
  const codeLength = 8;
  const codes: string[] = [];

  for (let i = 0; i < codeCount; i++) {
    const randomBytes = new Uint8Array(codeLength);
    crypto.getRandomValues(randomBytes);
    let code = '';
    for (let j = 0; j < codeLength; j++) {
      code += chars[randomBytes[j] % chars.length];
    }
    codes.push(code);
  }

  return codes;
}
