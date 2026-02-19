import { Injectable } from '@nestjs/common';

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
  private readonly store = new Map<string, PlaybookRecord>();

  private makeId(): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `playbook-${stamp}-${random}`;
  }

  private unsetExistingDefault(): void {
    for (const [id, record] of this.store.entries()) {
      if (record.is_default !== true) continue;
      this.store.set(id, {
        ...record,
        is_default: false,
      });
    }
  }

  list(): PlaybookRecord[] {
    return [...this.store.values()];
  }

  getById(id: string): PlaybookRecord | null {
    return this.store.get(id) ?? null;
  }

  create(payload: PlaybookRecord): PlaybookRecord {
    const rawId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || this.makeId();
    const isDefault = payload.is_default === true;
    const now = new Date().toISOString();

    if (isDefault) {
      this.unsetExistingDefault();
    }

    const next: PlaybookRecord = {
      ...payload,
      id,
      is_default: isDefault,
      created_at: payload.created_at ?? now,
      updated_at: now,
    };
    this.store.set(id, next);
    return next;
  }

  update(id: string, payload: PlaybookRecord): PlaybookRecord | null {
    const current = this.store.get(id);
    if (!current) return null;

    const nextIsDefault = payload.is_default === true;
    if (nextIsDefault) {
      this.unsetExistingDefault();
    }

    const next: PlaybookRecord = {
      ...current,
      ...payload,
      id,
      is_default: nextIsDefault ? true : current.is_default,
      updated_at: new Date().toISOString(),
    };
    this.store.set(id, next);
    return next;
  }

  remove(id: string): boolean {
    return this.store.delete(id);
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
