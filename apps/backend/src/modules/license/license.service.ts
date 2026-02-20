import type {
  licenseHeartbeatResponseSchema,
  licenseLeaseRequestSchema,
  licenseLeaseResponseSchema,
  licenseRevokeResponseSchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { LicenseRepository } from './license.repository';

type LeaseRequest = z.infer<typeof licenseLeaseRequestSchema>;
type LeaseResponse = z.infer<typeof licenseLeaseResponseSchema>;
type HeartbeatResponse = z.infer<typeof licenseHeartbeatResponseSchema>;
type RevokeResponse = z.infer<typeof licenseRevokeResponseSchema>;

interface LeaseRecord {
  lease: LeaseResponse;
  status: 'active' | 'revoked';
  revoked_at?: number;
}

@Injectable()
export class LicenseService {
  private readonly defaultTtlMs = 5 * 60 * 1000;

  constructor(private readonly repository: LicenseRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private normalizeUserId(userId: string): string {
    const normalized = String(userId || '').trim();
    if (!normalized) {
      throw new Error('userId is required');
    }
    return normalized;
  }

  private makeLeaseId(): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `lease-${stamp}-${random}`;
  }

  private makeToken(leaseId: string): string {
    const random = Math.random().toString(36).slice(2, 12);
    return `token-${leaseId}-${random}`;
  }

  async issueLease(
    payload: LeaseRequest,
    identity: { tenantId: string; userId: string },
  ): Promise<LeaseResponse> {
    const tenantId = this.normalizeTenantId(identity.tenantId);
    const userId = this.normalizeUserId(identity.userId);
    const leaseId = this.makeLeaseId();
    const now = Date.now();
    const lease: LeaseResponse = {
      lease_id: leaseId,
      token: this.makeToken(leaseId),
      expires_at: now + this.defaultTtlMs,
      tenant_id: tenantId,
      user_id: userId,
      vm_uuid: payload.vm_uuid,
      module: payload.module,
    };
    const record: LeaseRecord = {
      lease,
      status: 'active',
    };
    await this.repository.upsert({
      tenantId,
      id: leaseId,
      payload: record,
    });
    return lease;
  }

  async heartbeatLease(leaseId: string, tenantId: string): Promise<HeartbeatResponse | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedLeaseId = String(leaseId || '').trim();
    if (!normalizedLeaseId) return null;

    const buildHeartbeat = (record: LeaseRecord): HeartbeatResponse => ({
      lease_id: normalizedLeaseId,
      status: 'active',
      expires_at: record.lease.expires_at,
      last_heartbeat_at: Date.now(),
    });

    const record = await this.repository.findById(normalizedTenantId, normalizedLeaseId);
    if (!record || record.status !== 'active') return null;
    return buildHeartbeat(record);
  }

  async revokeLease(leaseId: string, tenantId: string): Promise<RevokeResponse | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedLeaseId = String(leaseId || '').trim();
    if (!normalizedLeaseId) return null;

    const toResult = (record: LeaseRecord): RevokeResponse => ({
      lease_id: normalizedLeaseId,
      status: 'revoked',
      revoked_at: record.revoked_at ?? Date.now(),
    });

    const record = await this.repository.findById(normalizedTenantId, normalizedLeaseId);
    if (!record) return null;
    const next: LeaseRecord = {
      ...record,
      status: 'revoked',
      revoked_at: Date.now(),
    };
    await this.repository.upsert({
      tenantId: normalizedTenantId,
      id: normalizedLeaseId,
      payload: next,
    });
    return toResult(next);
  }
}
