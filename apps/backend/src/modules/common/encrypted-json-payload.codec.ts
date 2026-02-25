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
}
