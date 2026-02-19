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
import type { z } from 'zod';

type ThemeAsset = z.infer<typeof themeAssetSchema>;
type ThemeAssetsList = z.infer<typeof themeAssetsListSchema>;
type ThemeAssetPresignUploadInput = z.infer<typeof themeAssetPresignUploadSchema>;
type ThemeAssetPresignUploadResponse = z.infer<typeof themeAssetPresignUploadResponseSchema>;
type ThemeAssetCompleteInput = z.infer<typeof themeAssetCompleteSchema>;
type ThemeAssetDeleteResult = z.infer<typeof themeAssetDeleteResultSchema>;

@Injectable()
export class ThemeAssetsService {
  private readonly store = new Map<string, ThemeAsset>();
  private readonly defaultTenantId = 'default';

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

  listAssets(): ThemeAssetsList {
    return {
      generated_at_ms: Date.now(),
      items: [...this.store.values()].filter((item) => item.status !== 'deleted'),
    };
  }

  createPresignedUpload(payload: ThemeAssetPresignUploadInput): ThemeAssetPresignUploadResponse {
    const now = Date.now();
    const nowIso = this.nowIso();
    const assetId = this.makeAssetId();
    const fileName = this.normalizeFileName(payload.filename);
    const objectKey = `theme-assets/${this.defaultTenantId}/${assetId}-${fileName}`;

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
    this.store.set(assetId, pending);

    return {
      asset_id: assetId,
      object_key: objectKey,
      upload_url: `https://example.local/theme-assets/upload/${assetId}`,
      expires_at_ms: now + 10 * 60_000,
      expires_in_seconds: 600,
    };
  }

  completeUpload(payload: ThemeAssetCompleteInput): ThemeAsset | null {
    const existing = this.store.get(payload.asset_id);
    if (!existing || existing.status === 'deleted') {
      return null;
    }

    const next: ThemeAsset = {
      ...existing,
      status: 'ready',
      width: Number.isFinite(payload.width) ? Number(payload.width) : (existing.width ?? null),
      height: Number.isFinite(payload.height) ? Number(payload.height) : (existing.height ?? null),
      image_url: `https://example.local/theme-assets/${existing.id}`,
      image_url_expires_at_ms: Date.now() + 300_000,
      updated_at: this.nowIso(),
    };
    this.store.set(existing.id, next);
    return next;
  }

  deleteAsset(assetId: string): ThemeAssetDeleteResult | null {
    const normalizedId = String(assetId || '').trim();
    if (!normalizedId) {
      return null;
    }

    const existing = this.store.get(normalizedId);
    if (!existing || existing.status === 'deleted') {
      return null;
    }

    const next: ThemeAsset = {
      ...existing,
      status: 'deleted',
      updated_at: this.nowIso(),
    };
    this.store.set(normalizedId, next);

    return {
      id: normalizedId,
      status: 'deleted',
    };
  }
}
