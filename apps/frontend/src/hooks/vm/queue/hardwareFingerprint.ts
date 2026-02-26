import {
  getVmHardwareFingerprint,
  type VmHardwareFingerprintPayload,
} from '../../../entities/vm/api/vmRuntimeFacade';

export interface VmHardwareFingerprint {
  mac: string;
  ssdSerial: string;
  smbiosArgs: string;
  meta: {
    brand?: string;
    manufacturer?: string;
    product?: string;
    cpu?: string;
  };
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Invalid ${fieldName}: empty string`);
  }
  return normalized;
}

export async function fetchVmHardwareFingerprint(): Promise<VmHardwareFingerprint> {
  const payload: VmHardwareFingerprintPayload = await getVmHardwareFingerprint();
  const metaPayload =
    payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
      ? payload.meta
      : {};

  return {
    mac: asString(payload.mac, 'hardware fingerprint mac'),
    ssdSerial: asString(payload.ssdSerial, 'hardware fingerprint ssdSerial'),
    smbiosArgs: asString(payload.smbiosArgs, 'hardware fingerprint smbiosArgs'),
    meta: {
      brand:
        typeof metaPayload.brand === 'string' && metaPayload.brand.trim().length > 0
          ? metaPayload.brand.trim()
          : undefined,
      manufacturer:
        typeof metaPayload.manufacturer === 'string' && metaPayload.manufacturer.trim().length > 0
          ? metaPayload.manufacturer.trim()
          : undefined,
      product:
        typeof metaPayload.product === 'string' && metaPayload.product.trim().length > 0
          ? metaPayload.product.trim()
          : undefined,
      cpu:
        typeof metaPayload.cpu === 'string' && metaPayload.cpu.trim().length > 0
          ? metaPayload.cpu.trim()
          : undefined,
    },
  };
}
