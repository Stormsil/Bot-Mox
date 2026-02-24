export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiFailureEnvelope {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = Number(options?.status || 500);
    this.code = String(options?.code || 'API_ERROR');
    this.details = options?.details;
  }
}

function hasContentType(response: Response, expected: string): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.toLowerCase().includes(expected.toLowerCase());
}

export async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  if (!hasContentType(response, 'application/json')) {
    if (response.ok) {
      return { success: true, data: undefined as T };
    }

    throw new ApiClientError(`HTTP ${response.status}`, {
      status: response.status,
      code: 'HTTP_ERROR',
    });
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!payload || typeof payload !== 'object') {
    throw new ApiClientError('Invalid API response payload', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }

  return payload;
}
