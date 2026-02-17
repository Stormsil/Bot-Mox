import { ApiClientError, apiDelete, apiGet, apiPost } from './apiClient';

export interface ThemeBackgroundAsset {
  id: string;
  object_key: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  status: 'pending' | 'ready' | 'failed' | 'deleted';
  image_url?: string | null;
  image_url_expires_at_ms?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface ListThemeAssetsResponse {
  generated_at_ms: number;
  items: ThemeBackgroundAsset[];
}

interface PresignUploadResponse {
  asset_id: string;
  object_key: string;
  upload_url: string;
  expires_at_ms: number;
  expires_in_seconds: number;
}

function assertAllowedImageType(file: File): void {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) {
    throw new ApiClientError('Only JPG, PNG and WEBP files are supported', {
      status: 400,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = Number(image.naturalWidth || 0);
      const height = Number(image.naturalHeight || 0);
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ApiClientError('Failed to read image dimensions', {
        status: 400,
        code: 'IMAGE_INVALID',
      }));
    };

    image.src = objectUrl;
  });
}

export async function listThemeAssets(): Promise<ListThemeAssetsResponse> {
  const response = await apiGet<ListThemeAssetsResponse>('/api/v1/theme-assets');
  const payload = response.data;
  return {
    generated_at_ms: Number(payload?.generated_at_ms || Date.now()),
    items: Array.isArray(payload?.items) ? payload.items : [],
  };
}

export async function uploadThemeAsset(file: File): Promise<ThemeBackgroundAsset> {
  assertAllowedImageType(file);

  const dimensions = await loadImageDimensions(file);
  const presign = await apiPost<PresignUploadResponse>('/api/v1/theme-assets/presign-upload', {
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  const upload = await fetch(presign.data.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!upload.ok) {
    throw new ApiClientError('Failed to upload image to storage', {
      status: upload.status,
      code: 'THEME_ASSET_UPLOAD_FAILED',
    });
  }

  const complete = await apiPost<ThemeBackgroundAsset>('/api/v1/theme-assets/complete', {
    asset_id: presign.data.asset_id,
    width: dimensions.width,
    height: dimensions.height,
  });

  return complete.data;
}

export async function deleteThemeAsset(assetId: string): Promise<void> {
  await apiDelete(`/api/v1/theme-assets/${encodeURIComponent(assetId)}`);
}
