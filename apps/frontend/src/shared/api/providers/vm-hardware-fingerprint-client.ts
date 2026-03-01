import type { ApiSuccessEnvelope } from '../apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../contracts/runtimeClient';

export interface VmHardwareFingerprintMeta extends Record<string, unknown> {
  brand?: string;
  manufacturer?: string;
  product?: string;
  cpu?: string;
}

export interface VmHardwareFingerprintPayload {
  mac: string;
  ssdSerial: string;
  smbiosArgs: string;
  meta: VmHardwareFingerprintMeta;
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeMeta(value: unknown): VmHardwareFingerprintMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const meta: VmHardwareFingerprintMeta = { ...source };
  const brand = normalizeString(source.brand);
  const manufacturer = normalizeString(source.manufacturer);
  const product = normalizeString(source.product);
  const cpu = normalizeString(source.cpu);

  if (brand) {
    meta.brand = brand;
  }
  if (manufacturer) {
    meta.manufacturer = manufacturer;
  }
  if (!meta.brand && manufacturer) {
    meta.brand = manufacturer;
  }
  if (product) {
    meta.product = product;
  }
  if (cpu) {
    meta.cpu = cpu;
  }

  return meta;
}

function normalizePayload(value: unknown): VmHardwareFingerprintPayload {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    mac: normalizeString(source.mac),
    ssdSerial: normalizeString(source.ssdSerial),
    smbiosArgs: normalizeString(source.smbiosArgs),
    meta: normalizeMeta(source.meta),
  };
}

export async function getVmHardwareFingerprintEnvelope(): Promise<
  ApiSuccessEnvelope<VmHardwareFingerprintPayload>
> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.vmHardwareFingerprint({
    headers: { authorization },
    query: {},
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      '/api/v1/vm/hardware-fingerprint',
      response.status,
      response.body,
    );
  }

  const body = response.body as ApiSuccessEnvelope<unknown>;
  return {
    ...body,
    data: normalizePayload(body.data),
  };
}

export async function getVmHardwareFingerprint(): Promise<VmHardwareFingerprintPayload> {
  const envelope = await getVmHardwareFingerprintEnvelope();
  return envelope.data;
}
