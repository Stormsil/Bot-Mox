import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PlaybooksRepository } from './playbooks.repository';

type PlaybookRecord = Record<string, unknown>;

export interface PlaybookValidationIssue {
  path?: string;
  message: string;
}

export interface PlaybookValidationWarning {
  message: string;
}

export interface PlaybookValidationResult {
  valid: boolean;
  errors: PlaybookValidationIssue[];
  warnings: PlaybookValidationWarning[];
}

@Injectable()
export class PlaybooksService {
  constructor(private readonly repository: PlaybooksRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private makeId(): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `playbook-${stamp}-${random}`;
  }

  private async unsetExistingDefault(tenantId: string, exceptId?: string): Promise<void> {
    const rows = await this.repository.list(tenantId);
    for (const row of rows) {
      const record = this.mapDbRow(row);
      const id = String(record.id || '').trim();
      if (!id || id === exceptId || record.is_default !== true) {
        continue;
      }
      await this.repository.upsert({
        tenantId,
        id,
        payload: {
          ...record,
          is_default: false,
          updated_at: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      });
    }
  }

  private mapDbRow(row: Record<string, unknown>): PlaybookRecord {
    const id = String(row.id || '').trim();
    const payload = row.payload;
    if (payload && typeof payload === 'object') {
      return { ...(payload as PlaybookRecord), ...(id ? { id } : {}) };
    }
    return id ? { id } : {};
  }

  async list(tenantId: string): Promise<PlaybookRecord[]> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rows = await this.repository.list(normalizedTenantId);
    return rows.map((row) => this.mapDbRow(row));
  }

  async getById(id: string, tenantId: string): Promise<PlaybookRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(id || '').trim();

    const row = await this.repository.findById(normalizedTenantId, normalizedId);
    return row ? this.mapDbRow(row) : null;
  }

  async create(payload: PlaybookRecord, tenantId: string): Promise<PlaybookRecord> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rawId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || this.makeId();
    const isDefault = payload.is_default === true;
    const now = new Date().toISOString();

    if (isDefault) {
      await this.unsetExistingDefault(normalizedTenantId, id);
    }

    const next: PlaybookRecord = {
      ...payload,
      id,
      is_default: isDefault,
      created_at: payload.created_at ?? now,
      updated_at: now,
    };
    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: next as Prisma.InputJsonValue,
    });
    return this.mapDbRow(row);
  }

  async update(
    id: string,
    payload: PlaybookRecord,
    tenantId: string,
  ): Promise<PlaybookRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(id || '').trim();
    const row = await this.repository.findById(normalizedTenantId, normalizedId);
    const current = row ? this.mapDbRow(row) : null;

    if (!current) return null;

    const nextIsDefault = payload.is_default === true;
    if (nextIsDefault) {
      await this.unsetExistingDefault(normalizedTenantId, normalizedId);
    }

    const next: PlaybookRecord = {
      ...current,
      ...payload,
      id: normalizedId,
      is_default: nextIsDefault ? true : current.is_default,
      updated_at: new Date().toISOString(),
    };
    const updatedRow = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id: normalizedId,
      payload: next as Prisma.InputJsonValue,
    });
    return this.mapDbRow(updatedRow);
  }

  async remove(id: string, tenantId: string): Promise<boolean> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(id || '').trim();
    return this.repository.delete(normalizedTenantId, normalizedId);
  }

  validate(content: string): PlaybookValidationResult {
    const normalized = String(content || '').trim();
    if (!normalized) {
      return {
        valid: false,
        errors: [{ message: 'Content is required' }],
        warnings: [],
      };
    }

    // Lightweight structural checks to keep parity with legacy 422 branch.
    const hasName = /(^|\n)\s*name\s*:/i.test(normalized);
    const hasRoles = /(^|\n)\s*roles\s*:/i.test(normalized);
    const hasYamlControl = /[:\-\n]/.test(normalized);
    const errors: PlaybookValidationIssue[] = [];

    if (!hasYamlControl) {
      errors.push({ message: 'Playbook content must be YAML-like' });
    }
    if (!hasName) {
      errors.push({ path: 'name', message: 'Missing "name" field' });
    }
    if (!hasRoles) {
      errors.push({ path: 'roles', message: 'Missing "roles" field' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
