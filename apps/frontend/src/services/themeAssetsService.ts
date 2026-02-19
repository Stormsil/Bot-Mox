import {
  completeThemeAssetViaContract,
  createThemeAssetPresignUploadViaContract,
  deleteThemeAssetViaContract,
  listThemeAssetsViaContract,
  type ThemeAssetMimeType,
  type ThemeAssetPayload,
} from '../providers/theme-assets-contract-client';
import { ApiClientError } from './apiClient';

export type ThemeBackgroundAsset = ThemeAssetPayload;

interface ListThemeAssetsResponse {
  generated_at_ms: number;
  items: ThemeBackgroundAsset[];
}

function assertAllowedImageType(file: File): void {
  const allowed = new Set<ThemeAssetMimeType>(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type as ThemeAssetMimeType)) {
    throw new ApiClientError('Only JPG, PNG and WEBP files are supported', {
      status: 400,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }
}

function getAllowedImageMimeType(file: File): ThemeAssetMimeType {
  assertAllowedImageType(file);
  return file.type as ThemeAssetMimeType;
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
      reject(
        new ApiClientError('Failed to read image dimensions', {
          status: 400,
          code: 'IMAGE_INVALID',
        }),
      );
    };

    image.src = objectUrl;
  });
}

export async function listThemeAssets(): Promise<ListThemeAssetsResponse> {
  const response = await listThemeAssetsViaContract();
  const payload = response.data;
  return {
    generated_at_ms: Number(payload?.generated_at_ms || Date.now()),
    items: Array.isArray(payload?.items) ? payload.items : [],
  };
}

export async function uploadThemeAsset(file: File): Promise<ThemeBackgroundAsset> {
  const mimeType = getAllowedImageMimeType(file);
  const dimensions = await loadImageDimensions(file);
  const presign = await createThemeAssetPresignUploadViaContract({
    filename: file.name,
    mime_type: mimeType,
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

  const complete = await completeThemeAssetViaContract({
    asset_id: presign.data.asset_id,
    width: dimensions.width,
    height: dimensions.height,
  });

  return complete.data;
}

export async function deleteThemeAsset(assetId: string): Promise<void> {
  await deleteThemeAssetViaContract(assetId);
}
