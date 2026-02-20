import { ApiError } from './api-client';

export function isRateLimitedError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 429 || err.code === 'RATE_LIMITED';
  }
  if (err instanceof Error) {
    return /rate[- ]?limit|too many requests/i.test(err.message);
  }
  return false;
}

export function isRevokedError(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'AGENT_REVOKED' || err.status === 403);
}
