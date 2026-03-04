import type { ApiSuccessEnvelope } from '../apiClient';
import { createContractRuntimeClient, toContractApiClientError } from '../contracts/runtimeClient';

export type ThemeAssetMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ThemeAssetPayload {
  id: string;
  object_key: string;
  mime_type: ThemeAssetMimeType;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  status: 'pending' | 'ready' | 'failed' | 'deleted';
  image_url?: string | null;
  image_url_expires_at_ms?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ThemeAssetsListPayload {
  generated_at_ms: number;
  items: ThemeAssetPayload[];
}

export interface ThemeAssetPresignPayload {
  filename: string;
  mime_type: ThemeAssetMimeType;
  size_bytes: number;
}

export interface ThemeAssetPresignResponsePayload {
  asset_id: string;
  object_key: string;
  upload_url: string;
  expires_at_ms: number;
  expires_in_seconds: number;
}

export interface ThemeAssetCompletePayload {
  asset_id: string;
  width?: number;
  height?: number;
}

export async function listThemeAssetsViaContract(): Promise<
  ApiSuccessEnvelope<ThemeAssetsListPayload>
> {
  const client = createContractRuntimeClient();
  const response = await client.themeAssetsList({});

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/theme-assets', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetsListPayload>;
}

export async function createThemeAssetPresignUploadViaContract(
  payload: ThemeAssetPresignPayload,
): Promise<ApiSuccessEnvelope<ThemeAssetPresignResponsePayload>> {
  const client = createContractRuntimeClient();
  const response = await client.themeAssetsPresignUpload({
    body: payload,
  });

  if (response.status !== 201) {
    throw toContractApiClientError(
      '/api/v1/theme-assets/presign-upload',
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetPresignResponsePayload>;
}

export async function completeThemeAssetViaContract(
  payload: ThemeAssetCompletePayload,
): Promise<ApiSuccessEnvelope<ThemeAssetPayload>> {
  const client = createContractRuntimeClient();
  const response = await client.themeAssetsComplete({
    body: payload,
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/theme-assets/complete', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetPayload>;
}

export async function deleteThemeAssetViaContract(
  assetId: string,
): Promise<ApiSuccessEnvelope<{ id: string; status: 'deleted' }>> {
  const client = createContractRuntimeClient();
  const response = await client.themeAssetsDelete({
    params: { id: assetId },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/theme-assets/${assetId}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<{ id: string; status: 'deleted' }>;
}
