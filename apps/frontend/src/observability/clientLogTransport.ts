import { buildApiUrl } from '../config/env';
import { withAuthHeaders } from '../services/authFetch';
import type { UiLogEvent } from './logContext';

const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 1500;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

const queue: UiLogEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let unloadListenerRegistered = false;

function scheduleFlush(delayMs = FLUSH_INTERVAL_MS): void {
  if (flushTimer) return;
  flushTimer = setTimeout(
    () => {
      flushTimer = null;
      void flushQueue();
    },
    Math.max(0, delayMs),
  );
}

function getEndpoint(): string {
  return buildApiUrl('/api/v1/client-logs');
}

async function postBatch(events: UiLogEvent[], attempt = 0): Promise<boolean> {
  try {
    const response = await fetch(getEndpoint(), {
      method: 'POST',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ events }),
      keepalive: true,
    });

    if (response.ok) {
      return true;
    }

    if (response.status >= 400 && response.status < 500) {
      return false;
    }
  } catch {
    // Retry below.
  }

  if (attempt >= MAX_RETRIES) {
    return false;
  }

  const delayMs = BASE_RETRY_DELAY_MS * 2 ** attempt;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return postBatch(events, attempt + 1);
}

async function flushQueue(): Promise<void> {
  if (inFlight || queue.length === 0) return;
  inFlight = true;

  const batch = queue.splice(0, MAX_BATCH_SIZE);
  const ok = await postBatch(batch);
  if (!ok) {
    // Put events back to front and keep bounded growth.
    queue.unshift(...batch);
    if (queue.length > 200) {
      queue.splice(200);
    }
  }

  inFlight = false;

  if (queue.length > 0) {
    scheduleFlush(queue.length >= MAX_BATCH_SIZE ? 0 : FLUSH_INTERVAL_MS);
  }
}

function flushWithBeacon(): void {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  if (queue.length === 0) return;

  const batch = queue.splice(0, MAX_BATCH_SIZE);
  try {
    const payload = JSON.stringify({ events: batch });
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(getEndpoint(), blob);
  } catch {
    // ignore on unload
  }
}

export function initClientLogTransport(): void {
  if (unloadListenerRegistered || typeof window === 'undefined') return;
  window.addEventListener('beforeunload', flushWithBeacon);
  unloadListenerRegistered = true;
}

export function enqueueClientLog(event: UiLogEvent): void {
  queue.push(event);
  if (queue.length > 200) {
    queue.shift();
  }
  scheduleFlush(queue.length >= MAX_BATCH_SIZE ? 0 : FLUSH_INTERVAL_MS);
}
