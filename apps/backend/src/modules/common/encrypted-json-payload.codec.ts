import type { Prisma } from '@prisma/client';
import { DataAtRestCrypto } from './data-at-rest-crypto';

export class EncryptedJsonPayloadCodec {
  private readonly atRestCrypto = new DataAtRestCrypto();

  private readAnyEnvelope(payload: Prisma.JsonValue): unknown {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const wrapped = (payload as Record<string, unknown>).__enc_payload_v1;
      return wrapped ?? payload;
    }
    return payload;
  }

  decryptJson<T>(payload: Prisma.JsonValue): T {
    const envelope = this.readAnyEnvelope(payload);
    const decrypted = this.atRestCrypto.decryptJson<T>(envelope);
    return (decrypted ?? payload) as T;
  }

  encryptJson(payload: Record<string, unknown>): Prisma.InputJsonValue {
    return {
      __enc_payload_v1: this.atRestCrypto.encryptJson(payload),
    } as unknown as Prisma.InputJsonValue;
  }

  encryptOpaqueJsonField(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
    return this.atRestCrypto.encryptJson(value) as unknown as Prisma.InputJsonValue;
  }

  decryptOpaqueJsonField(value: Prisma.JsonValue | null): Prisma.JsonValue | null {
    if (value === null || value === undefined) {
      return null;
    }
    try {
      const decrypted = this.atRestCrypto.decryptJson<Prisma.JsonValue>(value as unknown);
      return decrypted === null ? value : decrypted;
    } catch {
      return value;
    }
  }
}
