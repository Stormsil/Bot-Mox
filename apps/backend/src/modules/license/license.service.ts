import type {
  licenseHeartbeatResponseSchema,
  licenseLeaseRequestSchema,
  licenseLeaseResponseSchema,
  licenseRevokeResponseSchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';

type LeaseRequest = z.infer<typeof licenseLeaseRequestSchema>;
type LeaseResponse = z.infer<typeof licenseLeaseResponseSchema>;
type HeartbeatResponse = z.infer<typeof licenseHeartbeatResponseSchema>;
type RevokeResponse = z.infer<typeof licenseRevokeResponseSchema>;

interface LeaseRecord {
  lease: LeaseResponse;
  status: 'active' | 'revoked';
}

@Injectable()
export class LicenseService {
  private readonly leases = new Map<string, LeaseRecord>();
  private readonly defaultTenantId = 'default';
  private readonly defaultUserId = 'user-1';
  private readonly defaultTtlMs = 5 * 60 * 1000;

  private makeLeaseId(): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `lease-${stamp}-${random}`;
  }

  private makeToken(leaseId: string): string {
    const random = Math.random().toString(36).slice(2, 12);
    return `token-${leaseId}-${random}`;
  }

  issueLease(payload: LeaseRequest): LeaseResponse {
    const leaseId = this.makeLeaseId();
    const now = Date.now();
    const lease: LeaseResponse = {
      lease_id: leaseId,
      token: this.makeToken(leaseId),
      expires_at: now + this.defaultTtlMs,
      tenant_id: this.defaultTenantId,
      user_id: String(payload.user_id || this.defaultUserId).trim() || this.defaultUserId,
      vm_uuid: payload.vm_uuid,
      module: payload.module,
    };

    this.leases.set(leaseId, {
      lease,
      status: 'active',
    });

    return lease;
  }

  heartbeatLease(leaseId: string): HeartbeatResponse | null {
    const normalizedLeaseId = String(leaseId || '').trim();
    if (!normalizedLeaseId) return null;
    const record = this.leases.get(normalizedLeaseId);
    if (!record || record.status !== 'active') return null;

    return {
      lease_id: normalizedLeaseId,
      status: 'active',
      expires_at: record.lease.expires_at,
      last_heartbeat_at: Date.now(),
    };
  }

  revokeLease(leaseId: string): RevokeResponse | null {
    const normalizedLeaseId = String(leaseId || '').trim();
    if (!normalizedLeaseId) return null;
    const record = this.leases.get(normalizedLeaseId);
    if (!record) return null;

    record.status = 'revoked';
    this.leases.set(normalizedLeaseId, record);

    return {
      lease_id: normalizedLeaseId,
      status: 'revoked',
      revoked_at: Date.now(),
    };
  }
}
