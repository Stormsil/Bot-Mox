import { randomUUID } from 'node:crypto';
import type {
  themeAssetCompleteSchema,
  themeAssetDeleteResultSchema,
  themeAssetPresignUploadResponseSchema,
  themeAssetPresignUploadSchema,
  themeAssetSchema,
  themeAssetsListSchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { ThemeAssetsRepository } from './theme-assets.repository';

type ThemeAsset = z.infer<typeof themeAssetSchema>;
type ThemeAssetsList = z.infer<typeof themeAssetsListSchema>;
type ThemeAssetPresignUploadInput = z.infer<typeof themeAssetPresignUploadSchema>;
type ThemeAssetPresignUploadResponse = z.infer<typeof themeAssetPresignUploadResponseSchema>;
type ThemeAssetCompleteInput = z.infer<typeof themeAssetCompleteSchema>;
type ThemeAssetDeleteResult = z.infer<typeof themeAssetDeleteResultSchema>;

@Injectable()
export class ThemeAssetsService {
  constructor(private readonly repository: ThemeAssetsRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private makeAssetId(): string {
    return randomUUID();
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private normalizeFileName(name: string): string {
    const normalized = String(name || '')
      .trim()
      .toLowerCase();
    const compact = normalized
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return compact || 'background.png';
  }

  private clone<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private mapDbRowPayload(row: Record<string, unknown>): ThemeAsset {
    return this.clone(row.payload as ThemeAsset);
  }

  async listAssets(tenantId: string): Promise<ThemeAssetsList> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rows = await this.repository.listByTenant(normalizedTenantId);
    return {
      generated_at_ms: Date.now(),
      items: rows
        .map((row) => this.mapDbRowPayload(row))
        .filter((item) => item.status !== 'deleted'),
    };
  }

  async createPresignedUpload(
    payload: ThemeAssetPresignUploadInput,
    tenantId: string,
  ): Promise<ThemeAssetPresignUploadResponse> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const now = Date.now();
    const nowIso = this.nowIso();
    const assetId = this.makeAssetId();
    const fileName = this.normalizeFileName(payload.filename);
    const objectKey = `theme-assets/${normalizedTenantId}/${assetId}-${fileName}`;

    const pending: ThemeAsset = {
      id: assetId,
      object_key: objectKey,
      mime_type: payload.mime_type,
      size_bytes: payload.size_bytes,
      width: null,
      height: null,
      status: 'pending',
      image_url: null,
      image_url_expires_at_ms: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.repository.upsert({
      tenantId: normalizedTenantId,
      id: assetId,
      payload: this.clone(pending) as Prisma.InputJsonValue,
    });

    return {
      asset_id: assetId,
      object_key: objectKey,
      upload_url: `https://example.local/theme-assets/upload/${assetId}`,
      expires_at_ms: now + 10 * 60_000,
      expires_in_seconds: 600,
    };
  }

  async completeUpload(
    payload: ThemeAssetCompleteInput,
    tenantId: string,
  ): Promise<ThemeAsset | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);

    const buildNext = (existing: ThemeAsset): ThemeAsset => ({
      ...existing,
      status: 'ready',
      width: Number.isFinite(payload.width) ? Number(payload.width) : (existing.width ?? null),
      height: Number.isFinite(payload.height) ? Number(payload.height) : (existing.height ?? null),
      image_url: `https://example.local/theme-assets/${existing.id}`,
      image_url_expires_at_ms: Date.now() + 300_000,
      updated_at: this.nowIso(),
    });

    const row = await this.repository.findById(normalizedTenantId, payload.asset_id);
    if (!row) {
      return null;
    }
    const existing = this.mapDbRowPayload(row);
    if (!existing || existing.status === 'deleted') {
      return null;
    }
    const next = buildNext(existing);
    await this.repository.upsert({
      tenantId: normalizedTenantId,
      id: payload.asset_id,
      payload: this.clone(next) as Prisma.InputJsonValue,
    });
    return next;
  }

  async deleteAsset(assetId: string, tenantId: string): Promise<ThemeAssetDeleteResult | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(assetId || '').trim();
    if (!normalizedId) {
      return null;
    }

    const buildNext = (existing: ThemeAsset): ThemeAsset => ({
      ...existing,
      status: 'deleted',
      updated_at: this.nowIso(),
    });

    const row = await this.repository.findById(normalizedTenantId, normalizedId);
    if (!row) {
      return null;
    }
    const existing = this.mapDbRowPayload(row);
    if (!existing || existing.status === 'deleted') {
      return null;
    }
    const next = buildNext(existing);
    await this.repository.upsert({
      tenantId: normalizedTenantId,
      id: normalizedId,
      payload: this.clone(next) as Prisma.InputJsonValue,
    });
    return {
      id: normalizedId,
      status: 'deleted' as const,
    };
  }
}
