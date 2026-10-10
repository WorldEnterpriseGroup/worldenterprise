/**
 * Hashing, signing and token encryption. Raw email addresses and unsubscribe tokens are never stored or logged in clear:
 * a hash keys the blob records, and the token that goes into the email link is stored AES-256-GCM encrypted so the nurture
 * sweep can rebuild the link without keeping a usable token at rest.
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** A stable, non-reversible key for an address or an identifier. The salt separates key spaces so one hash cannot be replayed as another. */
export function keyHash(space: string, value: string): string {
  return sha256Hex(`${space}:${value}`);
}

/** Short hashed form for log lines (never the address itself). */
export function logHash(space: string, value: string): string {
  return keyHash(space, value).slice(0, 12);
}

export function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** 32 random bytes as base64url: the unsubscribe token that travels in the email link. */
export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

export function newRequestId(): string {
  return randomUUID();
}

function tokenKey(secret: string): Buffer {
  if (secret.length < 16) throw new Error('unsubscribe_key_too_short');
  return createHash('sha256').update(`worldenterprise-unsubscribe:${secret}`).digest();
}

/** `iv.tag.ciphertext`, each base64url. */
export function encryptToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptToken(sealed: string, secret: string): string {
  const [ivPart, tagPart, bodyPart] = sealed.split('.');
  if (!ivPart || !tagPart || !bodyPart) throw new Error('invalid_token_ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(secret), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(bodyPart, 'base64url')), decipher.final()]).toString('utf8');
}
