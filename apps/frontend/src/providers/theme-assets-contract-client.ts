import type { ApiSuccessEnvelope } from '../shared/api/apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../shared/api/contracts/runtimeClient';

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
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.themeAssetsList({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/theme-assets', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetsListPayload>;
}

export async function createThemeAssetPresignUploadViaContract(
  payload: ThemeAssetPresignPayload,
): Promise<ApiSuccessEnvelope<ThemeAssetPresignResponsePayload>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.themeAssetsPresignUpload({
    headers: { authorization },
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
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.themeAssetsComplete({
    headers: { authorization },
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
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.themeAssetsDelete({
    headers: { authorization },
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
