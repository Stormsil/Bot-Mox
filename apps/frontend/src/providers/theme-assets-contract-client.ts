import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

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

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3002';
}

function resolveBearerToken(): string {
  const authorization = withAuthHeaders().get('Authorization') || '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

function resolveAuthorizationHeader(): string {
  const token = resolveBearerToken();
  if (!token) {
    throw new ApiClientError('Missing auth token for contract request', {
      status: 401,
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  return `Bearer ${token}`;
}

function createRuntimeClient() {
  return createApiContractClient({
    baseUrl: resolveApiBaseUrl(),
    accessToken: resolveBearerToken(),
  });
}

function toApiClientError(path: string, status: number, body: unknown): ApiClientError {
  const envelope = body && typeof body === 'object' ? (body as { error?: unknown }) : {};
  const payload =
    envelope.error && typeof envelope.error === 'object'
      ? (envelope.error as { code?: unknown; message?: unknown; details?: unknown })
      : {};

  return new ApiClientError(String(payload.message || `Contract request failed: ${path}`), {
    status,
    code: String(payload.code || 'API_CONTRACT_ERROR'),
    details: payload.details ?? body,
  });
}

export async function listThemeAssetsViaContract(): Promise<
  ApiSuccessEnvelope<ThemeAssetsListPayload>
> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.themeAssetsList({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/theme-assets', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetsListPayload>;
}

export async function createThemeAssetPresignUploadViaContract(
  payload: ThemeAssetPresignPayload,
): Promise<ApiSuccessEnvelope<ThemeAssetPresignResponsePayload>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.themeAssetsPresignUpload({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 201) {
    throw toApiClientError('/api/v1/theme-assets/presign-upload', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetPresignResponsePayload>;
}

export async function completeThemeAssetViaContract(
  payload: ThemeAssetCompletePayload,
): Promise<ApiSuccessEnvelope<ThemeAssetPayload>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.themeAssetsComplete({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/theme-assets/complete', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<ThemeAssetPayload>;
}

export async function deleteThemeAssetViaContract(
  assetId: string,
): Promise<ApiSuccessEnvelope<{ id: string; status: 'deleted' }>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.themeAssetsDelete({
    headers: { authorization },
    params: { id: assetId },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/theme-assets/${assetId}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ id: string; status: 'deleted' }>;
}
