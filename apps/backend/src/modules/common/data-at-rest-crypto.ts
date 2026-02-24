import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

interface CipherEnvelopeV1 {
  __enc_v1: {
    alg: 'aes-256-gcm';
    kid: string;
    iv: string;
    tag: string;
    ct: string;
  };
}

function decodeKeyMaterial(raw: string): Buffer | null {
  const value = String(raw || '').trim();
  if (!value) {
    return null;
  }
  if (/^[a-fA-F0-9]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

function deriveKeyFromSeed(seed: string): Buffer {
  return createHash('sha256').update(seed).digest();
}

export class DataAtRestCrypto {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly keyId: string;
  private readonly keyById = new Map<string, Buffer>();

  constructor() {
    const explicit = decodeKeyMaterial(String(process.env.BOTMOX_DATA_ENCRYPTION_KEY || ''));
    if (explicit) {
      this.key = explicit;
      this.keyId =
        String(process.env.BOTMOX_DATA_ENCRYPTION_KEY_ID || 'env-key').trim() || 'env-key';
      this.keyById.set(this.keyId, this.key);
      this.loadExtraKeys();
      return;
    }

    const nodeEnv = String(process.env.NODE_ENV || 'development')
      .trim()
      .toLowerCase();
    if (nodeEnv === 'production') {
      throw new Error(
        'BOTMOX_DATA_ENCRYPTION_KEY is required in production (base64(32 bytes) or 64-char hex)',
      );
    }

    const seed =
      String(process.env.SUPABASE_JWT_SECRET || '').trim() ||
      String(process.env.BOTMOX_DEV_DATA_ENCRYPTION_SEED || 'botmox-dev-data-key').trim();
    this.key = deriveKeyFromSeed(seed);
    this.keyId = 'dev-derived';
    this.keyById.set(this.keyId, this.key);
    this.loadExtraKeys();
  }

  private loadExtraKeys(): void {
    const keyringRaw = String(process.env.BOTMOX_DATA_ENCRYPTION_KEYRING || '').trim();
    if (!keyringRaw) {
      return;
    }
    const entries = keyringRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const idx = entry.indexOf(':');
      if (idx <= 0) {
        continue;
      }
      const kid = entry.slice(0, idx).trim();
      const keyRaw = entry.slice(idx + 1).trim();
      if (!kid || !keyRaw) {
        continue;
      }
      const decoded = decodeKeyMaterial(keyRaw);
      if (!decoded) {
        continue;
      }
      this.keyById.set(kid, decoded);
    }
  }

  private isEnvelope(value: unknown): value is CipherEnvelopeV1 {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const rec = value as Record<string, unknown>;
    const v1 = rec.__enc_v1;
    if (!v1 || typeof v1 !== 'object') {
      return false;
    }
    const body = v1 as Record<string, unknown>;
    return (
      String(body.alg || '') === this.algorithm &&
      typeof body.kid === 'string' &&
      typeof body.iv === 'string' &&
      typeof body.tag === 'string' &&
      typeof body.ct === 'string'
    );
  }

  encryptString(plaintext: string): CipherEnvelopeV1 {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      __enc_v1: {
        alg: 'aes-256-gcm',
        kid: this.keyId,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ct: ciphertext.toString('base64'),
      },
    };
  }

  getActiveKeyId(): string {
    return this.keyId;
  }

  readEnvelopeKeyId(value: unknown): string | null {
    if (!this.isEnvelope(value)) {
      return null;
    }
    return String(value.__enc_v1.kid || '').trim() || null;
  }

  encryptJson(value: unknown): CipherEnvelopeV1 {
    return this.encryptString(JSON.stringify(value));
  }

  decryptString(value: unknown): string | null {
    if (!this.isEnvelope(value)) {
      return null;
    }
    const payload = value.__enc_v1;
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ct, 'base64');
    const preferredKid = String(payload.kid || '').trim();
    const candidates: Buffer[] = [];
    if (preferredKid && this.keyById.has(preferredKid)) {
      candidates.push(this.keyById.get(preferredKid) as Buffer);
    }
    if (!candidates.includes(this.key)) {
      candidates.push(this.key);
    }
    for (const [kid, key] of this.keyById.entries()) {
      if (preferredKid && kid === preferredKid) {
        continue;
      }
      if (!candidates.includes(key)) {
        candidates.push(key);
      }
    }

    for (const key of candidates) {
      try {
        const decipher = createDecipheriv(this.algorithm, key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return plaintext.toString('utf8');
      } catch {}
    }
    throw new Error('Failed to decrypt payload with available data encryption keys');
  }

  decryptJson<T>(value: unknown): T | null {
    const text = this.decryptString(value);
    if (text === null) {
      return null;
    }
    return JSON.parse(text) as T;
  }

  tryDecryptUnknown(value: unknown): unknown {
    try {
      const maybe = this.decryptString(value);
      return maybe === null ? value : maybe;
    } catch {
      return value;
    }
  }

  encryptStringField(record: JsonRecord, key: string): void {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      record[key] = this.encryptString(value);
    }
  }
}
